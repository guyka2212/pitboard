// FTCScout names its stats and score types after the game season (TeamEventStats2025, ...).
// Reading them from the schema keeps the queries working when a new season is added.
const { query } = require('./client');

const INTROSPECTION = `{
  stats: __type(name: "TeamEventStats") { possibleTypes { name fields { name } } }
  scores: __type(name: "MatchScores") { possibleTypes { name fields { name } } }
}`;

function parseTypes(data) {
  const seasonOf = (name) => Number((name.match(/\d{4}/) || [])[0]);
  const has = (type, field) => type.fields.some((f) => f.name === field);

  const stats = (data.stats?.possibleTypes || [])
    .filter((t) => has(t, 'opr') && has(t, 'avg') && has(t, 'rank'))
    .map((t) => ({ name: t.name, season: seasonOf(t.name), hasRecord: has(t, 'wins') }));
  const scores = (data.scores?.possibleTypes || [])
    .filter((t) => has(t, 'red') && has(t, 'blue'))
    .map((t) => t.name);

  return { stats, scores, seasons: [...new Set(stats.map((t) => t.season))].sort((a, b) => a - b) };
}

function statsFragment(types) {
  return types.stats
    .map((t) => `... on ${t.name} { rank qualMatchesPlayed ${t.hasRecord ? 'wins losses ties' : ''}
      opr { autoPoints dcPoints totalPointsNp } avg { totalPointsNp } }`)
    .join('\n');
}

function scoresFragment(types) {
  const side = '{ totalPoints totalPointsNp autoPoints dcPoints }';
  return types.scores.map((name) => `... on ${name} { red ${side} blue ${side} }`).join('\n');
}

/** The season to read stats from: the requested one, or the latest FTCScout has if it's newer. */
function statsSeasonFor(types, season) {
  if (types.seasons.includes(season)) return season;
  const older = types.seasons.filter((s) => s < season);
  return older.length ? older[older.length - 1] : null;
}

let cached = null;
async function loadTypes() {
  if (!cached) cached = query(INTROSPECTION).then(parseTypes).catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

module.exports = { loadTypes, parseTypes, statsFragment, scoresFragment, statsSeasonFor };
