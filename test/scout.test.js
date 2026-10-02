const test = require('node:test');
const assert = require('node:assert/strict');
const { eventLine, seasonLine, matchHistory } = require('../src/scout/transform');
const { parseTypes, statsSeasonFor, statsFragment } = require('../src/scout/schema');

const stats = (over = {}) => ({
  rank: 3,
  qualMatchesPlayed: 6,
  wins: 4,
  losses: 2,
  ties: 0,
  opr: { totalPointsNp: 154.9, autoPoints: 38.8, dcPoints: 116.1 },
  avg: { totalPointsNp: 228.5 },
  ...over,
});

test('event line reads OPRs, average and rank', () => {
  assert.deepEqual(eventLine(stats()), {
    rank: 3, played: 6, wins: 4, losses: 2, ties: 0, npOpr: 154.9, autoOpr: 38.8, dcOpr: 116.1, npAvg: 228.5,
  });
  assert.equal(eventLine(null), null);
  assert.equal(eventLine({ rank: 1 }), null);
});

test('season np average is weighted by matches played', () => {
  const line = seasonLine(
    { tot: { value: 98.3, rank: 662 }, auto: { value: 24 }, dc: { value: 74.3 }, count: 8368 },
    [{ stats: stats({ qualMatchesPlayed: 6, avg: { totalPointsNp: 100 } }) }, { stats: stats({ qualMatchesPlayed: 2, avg: { totalPointsNp: 200 } }) }, { stats: null }],
  );
  assert.equal(line.npAvg, 125);
  assert.equal(line.matches, 8);
  assert.equal(line.rank, 662);
  assert.equal(line.rankedOf, 8368);
  assert.equal(seasonLine(null, []), null);
});

test('match history is per event and from the team\'s side', () => {
  const participation = (eventCode, start, id, alliance, red, blue, scores) => ({
    eventCode,
    alliance,
    event: { name: eventCode, start },
    match: {
      id, matchNum: id, tournamentLevel: 'Quals', hasBeenPlayed: Boolean(scores), scheduledStartTime: `${start}T10:0${id}:00Z`,
      scores: scores && { red: { totalPoints: scores[0] }, blue: { totalPoints: scores[1] } },
      teams: [...red.map((n) => ({ teamNumber: n, alliance: 'Red' })), ...blue.map((n) => ({ teamNumber: n, alliance: 'Blue' }))],
    },
  });
  const history = matchHistory([
    participation('OLD', '2026-01-10', 2, 'Blue', [1, 2], [18833, 3], [100, 120]),
    participation('NEW', '2026-02-26', 6, 'Red', [18735, 18833], [25037, 22947], [129, 102]),
    participation('OLD', '2026-01-10', 1, 'Red', [18833, 4], [5, 6], null),
  ], 18833);

  assert.deepEqual(history.map((e) => e.code), ['NEW', 'OLD']);
  assert.deepEqual(history[1].matches.map((m) => m.label), ['Q1', 'Q2']);
  const win = history[0].matches[0];
  assert.deepEqual(win.partners.map((t) => t.number), [18735]);
  assert.deepEqual(win.opponents.map((t) => t.number), [25037, 22947]);
  assert.deepEqual(win.score, { ours: 129, theirs: 102 });
  assert.equal(win.outcome, 'win');
  assert.equal(history[1].matches[1].outcome, 'win');
  assert.equal(history[1].matches[0].played, false);
});

test('season support comes from the schema, falling back to the newest older season', () => {
  const types = parseTypes({
    stats: { possibleTypes: [
      { name: 'TeamEventStats2024', fields: [{ name: 'rank' }, { name: 'wins' }, { name: 'opr' }, { name: 'avg' }] },
      { name: 'TeamEventStats2025', fields: [{ name: 'rank' }, { name: 'wins' }, { name: 'opr' }, { name: 'avg' }] },
      { name: 'TeamEventStats2021Remote', fields: [{ name: 'rank' }, { name: 'opr' }, { name: 'avg' }] },
    ] },
    scores: { possibleTypes: [{ name: 'MatchScores2025', fields: [{ name: 'red' }, { name: 'blue' }] }, { name: 'MatchScores2021Remote', fields: [{ name: 'totalPoints' }] }] },
  });
  assert.deepEqual(types.seasons, [2021, 2024, 2025]);
  assert.deepEqual(types.scores, ['MatchScores2025']);
  assert.equal(statsSeasonFor(types, 2025), 2025);
  assert.equal(statsSeasonFor(types, 2026), 2025);
  assert.equal(statsSeasonFor(types, 2020), null);
  assert.match(statsFragment(types), /on TeamEventStats2021Remote \{ rank qualMatchesPlayed\s+opr/);
});
