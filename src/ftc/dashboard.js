const { createClient, FtcApiError } = require('./client');
const { seasonForDate, pickEvent, buildMatches, matchKey, dateAt } = require('./schedule');

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

/**
 * Which field each match is played on. Only the regular schedule has it, not the hybrid one.
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
 * The event has started, but everything FTC has for it was made before the first day:
 * a test run or an early draft, not the schedule the teams are actually playing.
 */
function preEventData(event, ftcUpdatedAt, today) {
  const start = (event.dateStart || '').slice(0, 10);
  if (!ftcUpdatedAt || !start || today < start) return false;
  return dateAt(event.timezone, new Date(ftcUpdatedAt)) < start;
}

/** The event runs today, but FTC's copy of it hasn't changed since an earlier day. */
function notSyncedToday(event, ftcUpdatedAt, today) {
  const start = (event.dateStart || '').slice(0, 10);
  const end = (event.dateEnd || event.dateStart || '').slice(0, 10);
  if (!ftcUpdatedAt || today < start || today > end) return false;
  return dateAt(event.timezone, new Date(ftcUpdatedAt)) < today;
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

async function findEvent(api, season, settings) {
  if (settings.eventCode) {
    const data = await api.get(`/${season}/events?eventCode=${encodeURIComponent(settings.eventCode)}`);
    const event = (data.events || [])[0];
    if (!event) throw new FtcApiError(`Event ${settings.eventCode} not found in the ${season} season`, 404);
    return event;
  }
  const data = await api.get(`/${season}/events?teamNumber=${settings.teamNumber}`);
  return pickEvent(data.events || []);
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

  const [qual, playoff, names, fields] = await Promise.all([
    hybridSchedule(api, season, event.code, 'qual'),
    hybridSchedule(api, season, event.code, 'playoff'),
    teamNames(api, season, event.code).catch(() => ({})),
    fieldsByMatch(api, season, event.code),
  ]);
  // Field numbers only mean something when the event runs more than one field.
  const multipleFields = new Set(fields.values()).size > 1;
  const schedule = [...qual.matches, ...playoff.matches].map((m) => ({ ...m, field: (multipleFields && fields.get(matchKey(m))) || null }));
  const today = dateAt(event.timezone, new Date());
  const ftcUpdatedAt = Math.max(qual.lastModified || 0, playoff.lastModified || 0) || null;
  const schedulePending = preEventData(event, ftcUpdatedAt, today);
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
    // When FTC last changed this event's schedule or results. Events only appear live in FTC's
    // data when the scorekeeper syncs them, so this is what tells "no new matches" from "not synced".
    ftcUpdatedAt,
    ftcNotSyncedToday: notSyncedToday(event, ftcUpdatedAt, today),
    // Pre-event data would show matches the team isn't actually playing, so show none instead.
    schedulePending,
    eventTeams: eventTeams(names, schedule),
    ...(schedulePending ? empty : buildMatches(schedule, teamNumber, names)),
  };
}

module.exports = { fetchDashboard, notSyncedToday, preEventData };
