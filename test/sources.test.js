const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseSource, conflicts } = require('../src/ftc/sources');
const { toHybrid, venueTime } = require('../src/scout/event-schedule');

const match = (n, teams, played = false) => ({
  tournamentLevel: 'QUALIFICATION',
  series: 0,
  matchNumber: n,
  actualStartTime: played ? '2026-10-04T09:00:00' : null,
  postResultTime: played ? '2026-10-04T09:04:00' : null,
  teams: teams.map((teamNumber, i) => ({ teamNumber, station: ['Red1', 'Red2', 'Blue1', 'Blue2'][i] })),
});
const source = (matches, updatedAt = 0, error) => ({ matches, updatedAt, ...(error ? { error } : {}) });

test('only one source has the event: use it', () => {
  const some = source([match(1, [1, 2, 3, 4])]);
  assert.equal(chooseSource(some, source([], 0, 'FTCScout has no data')), 'ftc');
  assert.equal(chooseSource(source([], 0, 'timeout'), some), 'ftcscout');
  assert.equal(chooseSource(source([]), some), 'ftcscout');
});

test('same schedule: the one with more matches played wins, ties go to FTC', () => {
  const lineup = [1, 2, 3, 4];
  const ftc = source([match(1, lineup, true), match(2, lineup)], 100);
  const ahead = source([match(1, lineup, true), match(2, lineup, true)], 50);
  assert.equal(chooseSource(ftc, ahead), 'ftcscout');
  assert.equal(chooseSource(ftc, source([match(1, lineup, true), match(2, lineup)], 999)), 'ftc');
});

test('different schedules: the most recently updated one wins', () => {
  const old = source([match(1, [1, 2, 3, 4], true)], Date.parse('2026-10-03T16:45:00Z'));
  const regenerated = source([match(1, [5, 6, 7, 8])], Date.parse('2026-10-04T13:00:00Z'));
  assert.equal(conflicts(old.matches, regenerated.matches), 1);
  assert.equal(chooseSource(old, regenerated), 'ftcscout');
  assert.equal(chooseSource(regenerated, old), 'ftc');
});

test('both sources down: FTC is reported', () => {
  assert.equal(chooseSource(source([], 0, 'a'), source([], 0, 'b')), 'ftc');
});

test('FTCScout matches become FTC-shaped matches in venue time', () => {
  assert.equal(venueTime('2026-07-09T08:45:00.000Z', 'Asia/Jerusalem'), '2026-07-09T11:45:00');
  assert.equal(venueTime(null, 'Asia/Jerusalem'), null);
  const m = toHybrid({
    matchNum: 4, series: 0, tournamentLevel: 'Quals', hasBeenPlayed: true, description: 'Q-4',
    scheduledStartTime: '2026-07-09T09:03:00.000Z', actualStartTime: '2026-07-09T09:10:00.000Z',
    postResultTime: '2026-07-09T09:14:00.000Z', updatedAt: '2026-07-09T09:15:00.000Z',
    scores: { red: { totalPoints: 120 }, blue: { totalPoints: 90 } },
    teams: [
      { teamNumber: 1, alliance: 'Red', station: 'One', surrogate: false, team: { name: 'A' } },
      { teamNumber: 2, alliance: 'Blue', station: 'Two', surrogate: true, team: { name: 'B' } },
    ],
  }, 'Asia/Jerusalem');
  assert.equal(m.tournamentLevel, 'QUALIFICATION');
  assert.equal(m.matchNumber, 4);
  assert.equal(m.startTime, '2026-07-09T12:03:00');
  assert.deepEqual([m.scoreRedFinal, m.scoreBlueFinal], [120, 90]);
  assert.deepEqual(m.teams.map((t) => t.station), ['Red1', 'Blue2']);
  assert.equal(m.teams[1].surrogate, true);

  const unplayed = toHybrid({ matchNum: 9, series: 0, tournamentLevel: 'Quals', hasBeenPlayed: false, scores: null, teams: [] }, 'UTC');
  assert.equal(unplayed.postResultTime, null);
  assert.equal(unplayed.scoreRedFinal, null);
  assert.equal(toHybrid({ matchNum: 2, series: 7, tournamentLevel: 'Finals', teams: [] }, 'UTC').description, 'Finals Match 2');
});
