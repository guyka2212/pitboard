// Reads an event's schedule and results from FTCScout, shaped like FTC's hybrid schedule so the
// rest of the app handles both sources the same way.
const { query } = require('./client');
const { loadTypes, scoresFragment } = require('./schema');

const STATION = { One: 1, Two: 2, Three: 3 };

/** FTCScout times are UTC; FTC's are wall-clock time at the venue. Convert to FTC's form. */
function venueTime(iso, timeZone) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    // sv-SE formats as "2026-07-09 11:45:00", which is one character away from ISO.
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: timeZone || undefined,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(date).replace(' ', 'T');
  } catch {
    return iso.slice(0, 19);
  }
}

function toHybrid(m, timeZone) {
  const qual = m.tournamentLevel === 'Quals';
  const red = m.scores && m.scores.red;
  const blue = m.scores && m.scores.blue;
  return {
    tournamentLevel: qual ? 'QUALIFICATION' : 'PLAYOFF',
    series: m.series || 0,
    matchNumber: m.matchNum,
    description: qual ? `Qualification ${m.matchNum}` : m.tournamentLevel === 'Finals' ? `Finals Match ${m.matchNum}` : m.description || '',
    startTime: venueTime(m.scheduledStartTime, timeZone),
    actualStartTime: venueTime(m.actualStartTime, timeZone),
    postResultTime: m.hasBeenPlayed ? venueTime(m.postResultTime || m.updatedAt, timeZone) : null,
    scoreRedFinal: red && m.hasBeenPlayed ? red.totalPoints : null,
    scoreBlueFinal: blue && m.hasBeenPlayed ? blue.totalPoints : null,
    teams: (m.teams || []).map((t) => ({
      teamNumber: t.teamNumber,
      station: `${t.alliance}${STATION[t.station] || 1}`,
      surrogate: Boolean(t.surrogate),
      teamName: (t.team && t.team.name) || '',
    })),
  };
}

const EVENT_FIELDS = 'code name start end timezone location { city }';

function toFtcEvent(e) {
  return {
    code: e.code,
    name: e.name,
    city: e.location && e.location.city,
    dateStart: e.start,
    dateEnd: e.end,
    timezone: e.timezone,
  };
}

/** FTCScout only knows seasons whose game it has added; asking for another one fails. */
async function supportsSeason(season) {
  const types = await loadTypes();
  return types.seasons.includes(season);
}

/** The team's events in a season, in the same shape as FTC's event listing. */
async function teamEvents(teamNumber, season) {
  if (!(await supportsSeason(season))) return [];
  const data = await query(
    `query ($n: Int!, $s: Int!) { teamByNumber(number: $n) { events(season: $s) { event { ${EVENT_FIELDS} } } } }`,
    { n: teamNumber, s: season },
  );
  const events = (data.teamByNumber && data.teamByNumber.events) || [];
  return events.map((p) => p.event).filter(Boolean).map(toFtcEvent);
}

/**
 * Event info, team names and matches. `updatedAt` is the newest change FTCScout has for any
 * match, so it can be compared with FTC's Last-Modified. Returns null if FTCScout doesn't know the event.
 */
async function eventSchedule(season, eventCode) {
  if (!(await supportsSeason(season))) return null;
  const types = await loadTypes();
  const data = await query(
    `query ($s: Int!, $c: String!) {
      eventByCode(season: $s, code: $c) {
        ${EVENT_FIELDS}
        teams { teamNumber team { name } }
        matches {
          matchNum series description tournamentLevel hasBeenPlayed
          scheduledStartTime actualStartTime postResultTime updatedAt
          scores { ${scoresFragment(types)} }
          teams { teamNumber alliance station surrogate team { name } }
        }
      }
    }`,
    { s: season, c: eventCode },
  );
  const event = data.eventByCode;
  if (!event) return null;

  const names = {};
  for (const t of event.teams || []) names[t.teamNumber] = (t.team && t.team.name) || '';
  const updated = (event.matches || []).map((m) => Date.parse(m.updatedAt)).filter(Number.isFinite);
  return {
    event: toFtcEvent(event),
    names,
    matches: (event.matches || []).map((m) => toHybrid(m, event.timezone)),
    updatedAt: updated.length ? Math.max(...updated) : null,
  };
}

module.exports = { eventSchedule, teamEvents, toHybrid, venueTime };
