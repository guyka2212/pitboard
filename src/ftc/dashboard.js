const { createClient, FtcApiError } = require('./client');
const { seasonForDate, pickEvent, buildMatches, matchKey, dateAt } = require('./schedule');
const { chooseSource, conflicts } = require('./sources');
const scout = require('../scout/event-schedule');

const SOURCE_NAME = { ftc: 'FTC Events', ftcscout: 'FTCScout' };

async function currentSeason(api) {
  try {
    const index = await api.get('');
    if (Number.isInteger(index.currentSeason)) return index.currentSeason;
  } catch (err) {
    if (err.status === 401) throw err;
  }
  return seasonForDate();
}

async function hybridSchedule(api, season, eventCode, level) {
  try {
    const { data, lastModified } = await api.request(`/${season}/schedule/${encodeURIComponent(eventCode)}/${level}/hybrid`);
    return { matches: Array.isArray(data.schedule) ? data.schedule : [], lastModified };
  } catch (err) {
    // Playoffs aren't published until alliance selection; that's not an error.
    if (err.status === 400 || err.status === 404) return { matches: [], lastModified: null };
    throw err;
  }
}

/** The event's schedule as FTC Events has it, or { error } if FTC can't be reached. */
async function ftcSchedule(api, season, eventCode) {
  try {
    const [qual, playoff] = await Promise.all([
      hybridSchedule(api, season, eventCode, 'qual'),
      hybridSchedule(api, season, eventCode, 'playoff'),
    ]);
    return {
      matches: [...qual.matches, ...playoff.matches],
      updatedAt: Math.max(qual.lastModified || 0, playoff.lastModified || 0) || null,
    };
  } catch (err) {
    return { matches: [], updatedAt: null, error: err.message };
  }
}

/** The same from FTCScout, or { error } if it doesn't have the event or can't be reached. */
async function scoutSchedule(season, eventCode) {
  try {
    const result = await scout.eventSchedule(season, eventCode);
    if (!result) return { matches: [], updatedAt: null, names: {}, error: 'FTCScout has no data for this event yet' };
    return result;
  } catch (err) {
    return { matches: [], updatedAt: null, names: {}, error: err.message };
  }
}

/**
 * Which field each match is played on. Only FTC's regular schedule has it.
 * Nice to have, so a failure here just means no field numbers.
 */
async function fieldsByMatch(api, season, eventCode) {
  const fields = new Map();
  await Promise.all(['qual', 'playoff'].map(async (level) => {
    try {
      const data = await api.get(`/${season}/schedule/${encodeURIComponent(eventCode)}?tournamentLevel=${level}`);
      for (const m of data.schedule || []) if (m.field) fields.set(matchKey(m), String(m.field));
    } catch {
      // keep going without fields
    }
  }));
  return fields;
}

/**
 * The event has started, but everything the source has for it was made before the first day:
 * a test run or an early draft, not the schedule the teams are actually playing.
 */
function preEventData(event, updatedAt, today) {
  const start = (event.dateStart || '').slice(0, 10);
  if (!updatedAt || !start || today < start) return false;
  return dateAt(event.timezone, new Date(updatedAt)) < start;
}

/** The event runs today, but the data hasn't changed since an earlier day. */
function notSyncedToday(event, updatedAt, today) {
  const start = (event.dateStart || '').slice(0, 10);
  const end = (event.dateEnd || event.dateStart || '').slice(0, 10);
  if (!updatedAt || today < start || today > end) return false;
  return dateAt(event.timezone, new Date(updatedAt)) < today;
}

async function teamNames(api, season, eventCode) {
  const names = {};
  for (let page = 1, pageTotal = 1; page <= pageTotal && page <= 20; page += 1) {
    const data = await api.get(`/${season}/teams?eventCode=${encodeURIComponent(eventCode)}&page=${page}`);
    for (const t of data.teams || []) names[t.teamNumber] = t.nameShort || t.nameFull || '';
    pageTotal = data.pageTotal || 1;
  }
  return names;
}

/** Everyone at the event: the registered team list, plus anyone only seen in the schedule. */
function eventTeams(names, schedule) {
  const all = new Map(Object.entries(names).map(([number, name]) => [Number(number), name]));
  for (const m of schedule) {
    for (const t of m.teams || []) {
      if (t.teamNumber && !all.has(t.teamNumber)) all.set(t.teamNumber, t.teamName || '');
    }
  }
  return [...all].map(([number, name]) => ({ number, name })).sort((a, b) => a.number - b.number);
}

async function teamName(api, season, teamNumber) {
  try {
    const data = await api.get(`/${season}/teams?teamNumber=${teamNumber}`);
    const team = (data.teams || [])[0];
    return (team && (team.nameShort || team.nameFull)) || '';
  } catch {
    return '';
  }
}

/** Finds the event on FTC Events; if FTC can't be reached, on FTCScout. */
async function findEvent(api, season, settings) {
  const teamNumber = Number(settings.teamNumber);
  try {
    if (settings.eventCode) {
      const data = await api.get(`/${season}/events?eventCode=${encodeURIComponent(settings.eventCode)}`);
      const event = (data.events || [])[0];
      if (!event) throw new FtcApiError(`Event ${settings.eventCode} isn't in the ${season} season. Check the Season setting.`, 404);
      return event;
    }
    const data = await api.get(`/${season}/events?teamNumber=${teamNumber}`);
    return pickEvent(data.events || []);
  } catch (err) {
    if (err.status === 404 && settings.eventCode) {
      throw new FtcApiError(`Event ${settings.eventCode} isn't in the ${season} season. Check the Season setting.`, 404);
    }
    // A wrong account or an unknown event is a real answer; only a failed connection is worth retrying elsewhere.
    if (err.status && err.status !== 429 && err.status < 500) throw err;
    try {
      if (settings.eventCode) {
        const fallback = await scout.eventSchedule(season, settings.eventCode);
        if (fallback) return fallback.event;
      } else {
        const events = await scout.teamEvents(teamNumber, season);
        if (events.length) return pickEvent(events);
      }
    } catch {
      // FTCScout is down too; report FTC's error below
    }
    throw err;
  }
}

function summary(source) {
  return { matches: source.matches.length, updatedAt: source.updatedAt || null, error: source.error || null };
}

async function fetchDashboard(settings, credentials) {
  const api = createClient(credentials);
  const teamNumber = Number(settings.teamNumber);
  const season = Number(settings.season) || (await currentSeason(api));
  const event = await findEvent(api, season, settings);

  if (!event) {
    return {
      season,
      teamNumber,
      teamName: await teamName(api, season, teamNumber),
      event: null,
      eventTeams: [],
      matches: [],
      nextMatch: null,
      currentMatch: null,
      onField: null,
    };
  }

  const [ftc, ftcscout, ftcNames, fields] = await Promise.all([
    ftcSchedule(api, season, event.code),
    scoutSchedule(season, event.code),
    teamNames(api, season, event.code).catch(() => ({})),
    fieldsByMatch(api, season, event.code),
  ]);
  if (ftc.error && ftcscout.error) throw new FtcApiError(ftc.error, 0);

  const used = chooseSource(ftc, ftcscout);
  const chosen = used === 'ftc' ? ftc : ftcscout;
  const names = { ...ftcscout.names, ...ftcNames };

  // Field numbers only mean something when the event runs more than one field.
  const multipleFields = new Set(fields.values()).size > 1;
  const schedule = chosen.matches.map((m) => ({ ...m, field: (multipleFields && fields.get(matchKey(m))) || null }));
  const today = dateAt(event.timezone, new Date());
  const schedulePending = preEventData(event, chosen.updatedAt, today);
  const empty = { matches: [], nextMatch: null, currentMatch: null, onField: null };

  return {
    season,
    teamNumber,
    teamName: names[teamNumber] || (await teamName(api, season, teamNumber)),
    event: {
      code: event.code,
      name: event.name,
      city: event.city,
      dateStart: event.dateStart,
      dateEnd: event.dateEnd,
      timezone: event.timezone || null,
    },
    source: {
      used: SOURCE_NAME[used],
      ftc: summary(ftc),
      ftcscout: summary(ftcscout),
      // Both had matches but listed different teams or matches: worth knowing which one is shown.
      disagree: !ftc.error && !ftcscout.error && ftc.matches.length > 0 && ftcscout.matches.length > 0
        && conflicts(ftc.matches, ftcscout.matches) > 0,
    },
    // When the shown data last changed. Events only appear live once the scorekeeper syncs
    // them, so this is what tells "no new matches" from "not synced".
    dataUpdatedAt: chosen.updatedAt || null,
    dataNotSyncedToday: notSyncedToday(event, chosen.updatedAt, today),
    // Pre-event data would show matches the team isn't actually playing, so show none instead.
    schedulePending,
    eventTeams: eventTeams(names, schedule),
    ...(schedulePending ? empty : buildMatches(schedule, teamNumber, names)),
  };
}

module.exports = { fetchDashboard, notSyncedToday, preEventData };
