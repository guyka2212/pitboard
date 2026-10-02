const { createClient, FtcApiError } = require('./client');
const { seasonForDate, pickEvent, buildMatches } = require('./schedule');

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
    const data = await api.get(`/${season}/schedule/${encodeURIComponent(eventCode)}/${level}/hybrid`);
    return Array.isArray(data.schedule) ? data.schedule : [];
  } catch (err) {
    // Playoffs aren't published until alliance selection; that's not an error.
    if (err.status === 400 || err.status === 404) return [];
    throw err;
  }
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
    if (!event) throw new FtcApiError(`האירוע ${settings.eventCode} לא נמצא בעונה ${season}`, 404);
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
    return { season, teamNumber, teamName: await teamName(api, season, teamNumber), event: null, matches: [], nextMatch: null };
  }

  const [qual, playoff, names] = await Promise.all([
    hybridSchedule(api, season, event.code, 'qual'),
    hybridSchedule(api, season, event.code, 'playoff'),
    teamNames(api, season, event.code).catch(() => ({})),
  ]);

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
    },
    ...buildMatches([...qual, ...playoff], teamNumber, names),
  };
}

module.exports = { fetchDashboard };
