// Pure functions that turn FTC API responses into what the dashboard shows.

/** FTC seasons are named by the year they start in; kickoff is in September. */
function seasonForDate(now = new Date()) {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

function localDateString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date (YYYY-MM-DD) where the event is, e.g. "America/Chicago". */
function dateAt(timeZone, now) {
  if (!timeZone) return localDateString(now);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return localDateString(now);
  }
}

/**
 * The event happening today or next; when all are over, the most recent one.
 * "Today" is the date at the venue: a Texas event is still running after midnight in Israel.
 */
function pickEvent(events, now = new Date()) {
  const byStart = events
    .filter((e) => e && e.code)
    .sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''));
  const upcoming = byStart.find((e) => (e.dateEnd || e.dateStart || '').slice(0, 10) >= dateAt(e.timezone, now));
  return upcoming || byStart[byStart.length - 1] || null;
}

function matchLabel(m, level) {
  if (level === 'qual') return `Q${m.matchNumber}`;
  const description = m.description || '';
  // "Final Bracket Round 4 Match 6" is still a bracket match; only the finals series is F1, F2...
  if (/final/i.test(description) && !/bracket/i.test(description)) return `F${m.matchNumber}`;
  return `P${m.series || m.matchNumber}`;
}

// A real match takes 2:30 plus scoring. Scorekeepers sometimes commit a run of matches as 0-0
// within seconds (a test run, or skipping ahead); FTC's own site shows those as unplayed.
const MIN_PLAYED_MS = 60 * 1000;

function wasSkipped(m) {
  if (m.scoreRedFinal !== 0 || m.scoreBlueFinal !== 0 || !m.actualStartTime || !m.postResultTime) return false;
  const ran = Date.parse(m.postResultTime) - Date.parse(m.actualStartTime);
  return Number.isFinite(ran) && ran < MIN_PLAYED_MS;
}

// A match that has started is no longer "next", even before its result is posted.
const hasStarted = (m) => !wasSkipped(m) && Boolean(m.actualStartTime || m.postResultTime);

const levelOf = (m) => (/^qual/i.test(m.tournamentLevel || '') ? 'qual' : 'playoff');

/** Identifies a match the same way in the hybrid and the regular schedule. */
const matchKey = (m) => `${levelOf(m)}-${m.series || 0}-${m.matchNumber}`;

function toTeam(t, names) {
  return {
    number: t.teamNumber,
    display: t.displayTeamNumber || String(t.teamNumber),
    name: t.teamName || names[t.teamNumber] || '',
  };
}

/** Converts a hybrid-schedule match, or returns null when `teamNumber` doesn't play in it. */
function toMatch(m, teamNumber, names = {}) {
  const teams = (m.teams || []).filter((t) => t && t.teamNumber && typeof t.station === 'string');
  const me = teams.find((t) => t.teamNumber === teamNumber);
  if (!me) return null;

  const alliance = me.station.startsWith('Red') ? 'red' : 'blue';
  const side = alliance === 'red' ? 'Red' : 'Blue';
  const level = levelOf(m);

  const hasScore = !wasSkipped(m) && Number.isFinite(m.scoreRedFinal) && Number.isFinite(m.scoreBlueFinal);
  const ours = alliance === 'red' ? m.scoreRedFinal : m.scoreBlueFinal;
  const theirs = alliance === 'red' ? m.scoreBlueFinal : m.scoreRedFinal;
  let outcome = null;
  if (hasScore && m.postResultTime) outcome = ours > theirs ? 'win' : ours < theirs ? 'loss' : 'tie';

  return {
    key: matchKey(m),
    level,
    label: matchLabel(m, level),
    description: m.description || '',
    startTime: m.startTime || null,
    field: m.field ? String(m.field) : null,
    station: me.station,
    alliance,
    partners: teams.filter((t) => t.station.startsWith(side) && t.teamNumber !== teamNumber).map((t) => toTeam(t, names)),
    opponents: teams.filter((t) => !t.station.startsWith(side)).map((t) => toTeam(t, names)),
    started: hasStarted(m),
    score: hasScore ? { ours, theirs } : null,
    outcome,
  };
}

/**
 * `schedule` is the whole event in playing order (quals, then playoffs).
 * For the next match it adds `matchesBefore`: how many matches still have to start before ours.
 * `currentMatch` is ours while it's being played: started, no result posted yet.
 */
function buildMatches(schedule, teamNumber, names) {
  let lastStarted = -1;
  schedule.forEach((m, i) => {
    if (hasStarted(m)) lastStarted = i;
  });

  const matches = [];
  let nextMatch = null;
  let currentMatch = null;
  schedule.forEach((m, i) => {
    const match = toMatch(m, teamNumber, names);
    if (!match) return;
    matches.push(match);
    if (match.started && !m.postResultTime) currentMatch = match;
    if (!nextMatch && !match.started) {
      nextMatch = { ...match, matchesBefore: Math.max(0, i - lastStarted - 1) };
    }
  });

  const onField = lastStarted >= 0 ? schedule[lastStarted] : null;
  return {
    matches,
    nextMatch,
    currentMatch,
    onField: onField ? { label: matchLabel(onField, levelOf(onField)), field: onField.field ? String(onField.field) : null } : null,
  };
}

module.exports = { seasonForDate, localDateString, dateAt, pickEvent, matchLabel, matchKey, toMatch, buildMatches };
