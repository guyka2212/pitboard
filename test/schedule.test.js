const test = require('node:test');
const assert = require('node:assert/strict');
const { pickEvent, matchLabel, toMatch, buildMatches, seasonForDate } = require('../src/ftc/schedule');

// Shape taken from a real /schedule/{event}/qual/hybrid response.
const playedQual = {
  description: 'Qualification 1',
  tournamentLevel: 'QUALIFICATION',
  series: 0,
  matchNumber: 1,
  startTime: '2026-07-09T11:45:00',
  actualStartTime: '2026-07-09T11:56:35.91',
  postResultTime: '2026-07-09T12:00:30.162',
  scoreRedFinal: 175,
  scoreBlueFinal: 108,
  teams: [
    { teamNumber: 33849, station: 'Blue2', teamName: 'The Arc' },
    { teamNumber: 24321, station: 'Blue1', teamName: 'BLACK GHOST' },
    { teamNumber: 16473, station: 'Red1', teamName: 'SciFighters' },
    { teamNumber: 18833, station: 'Red2', teamName: 'Us' },
  ],
};

const upcomingQual = {
  ...playedQual,
  description: 'Qualification 7',
  matchNumber: 7,
  startTime: '2026-07-09T12:40:00',
  actualStartTime: null,
  postResultTime: null,
  scoreRedFinal: null,
  scoreBlueFinal: null,
};

test('toMatch reads alliance, partner and result from our side', () => {
  const m = toMatch(playedQual, 18833);
  assert.equal(m.alliance, 'red');
  assert.equal(m.station, 'Red2');
  assert.deepEqual(m.partners.map((p) => p.number), [16473]);
  assert.deepEqual(m.opponents.map((p) => p.number), [33849, 24321]);
  assert.deepEqual(m.score, { ours: 175, theirs: 108 });
  assert.equal(m.outcome, 'win');
  assert.equal(m.started, true);

  const blue = toMatch(playedQual, 24321);
  assert.equal(blue.alliance, 'blue');
  assert.deepEqual(blue.score, { ours: 108, theirs: 175 });
  assert.equal(blue.outcome, 'loss');
});

test('toMatch returns null when the team is not in the match', () => {
  assert.equal(toMatch(playedQual, 99999), null);
});

test('toMatch ignores teams with no number yet (unfilled playoff slots)', () => {
  const m = toMatch({ ...upcomingQual, teams: [...upcomingQual.teams, { teamNumber: null, station: 'Red3' }] }, 18833);
  assert.equal(m.partners.length, 1);
});

test('toMatch uses the event team list when the schedule has no name', () => {
  const noNames = { ...upcomingQual, teams: upcomingQual.teams.map(({ teamName, ...t }) => t) };
  const m = toMatch(noNames, 18833, { 16473: 'From teams endpoint' });
  assert.equal(m.partners[0].name, 'From teams endpoint');
});

test('a match without a posted result has no outcome', () => {
  const m = toMatch({ ...playedQual, postResultTime: null }, 18833);
  assert.equal(m.outcome, null);
  assert.equal(m.started, true);
});

test('next match is the first one that has not started', () => {
  const { matches, nextMatch } = buildMatches([playedQual, upcomingQual], 18833, {});
  assert.equal(matches.length, 2);
  assert.equal(nextMatch.label, 'Q7');
});

test('no next match once everything has been played', () => {
  assert.equal(buildMatches([playedQual], 18833, {}).nextMatch, null);
});

test('playoff labels are short', () => {
  assert.equal(matchLabel({ matchNumber: 12 }, 'qual'), 'Q12');
  assert.equal(matchLabel({ series: 3, matchNumber: 1, description: 'Lower Bracket  Round 2 Match 3' }, 'playoff'), 'P3');
  assert.equal(matchLabel({ series: 6, matchNumber: 1, description: 'Final Bracket  Round 4 Match 6' }, 'playoff'), 'P6');
  assert.equal(matchLabel({ series: 7, matchNumber: 2, description: 'Finals Match 2' }, 'playoff'), 'F2');
});

test('pickEvent prefers the current or next event, then the latest past one', () => {
  const events = [
    { code: 'B', dateStart: '2026-11-14T00:00:00', dateEnd: '2026-11-14T00:00:00' },
    { code: 'A', dateStart: '2026-09-20T00:00:00', dateEnd: '2026-09-20T00:00:00' },
    { code: 'C', dateStart: '2027-01-10T00:00:00', dateEnd: '2027-01-11T00:00:00' },
  ];
  assert.equal(pickEvent(events, '2026-10-02').code, 'B');
  assert.equal(pickEvent(events, '2026-11-14').code, 'B');
  assert.equal(pickEvent(events, '2027-01-11').code, 'C');
  assert.equal(pickEvent(events, '2027-05-01').code, 'C');
  assert.equal(pickEvent([], '2026-10-02'), null);
});

test('season follows the September kickoff', () => {
  assert.equal(seasonForDate(new Date(2026, 8, 1)), 2026);
  assert.equal(seasonForDate(new Date(2027, 2, 1)), 2026);
});

function qual(n, teams, started) {
  return {
    tournamentLevel: 'QUALIFICATION',
    series: 0,
    matchNumber: n,
    description: `Qualification ${n}`,
    actualStartTime: started ? 'x' : null,
    postResultTime: null,
    scoreRedFinal: null,
    scoreBlueFinal: null,
    teams: teams.map((teamNumber, i) => ({ teamNumber, station: ['Red1', 'Red2', 'Blue1', 'Blue2'][i] })),
  };
}

test('counts how many matches still start before ours', () => {
  const others = [1, 2, 3, 4];
  const ours = [18833, 5, 6, 7];
  const schedule = [qual(1, others, true), qual(2, others, true), qual(3, others, false), qual(4, others, false), qual(5, ours, false)];
  const { nextMatch, onField } = buildMatches(schedule, 18833, {});
  assert.equal(nextMatch.label, 'Q5');
  assert.equal(nextMatch.matchesBefore, 2);
  assert.equal(onField, 'Q2');
});

test('before the event starts, every earlier match counts', () => {
  const schedule = [qual(1, [1, 2, 3, 4], false), qual(2, [18833, 5, 6, 7], false)];
  const { nextMatch, onField } = buildMatches(schedule, 18833, {});
  assert.equal(nextMatch.matchesBefore, 1);
  assert.equal(onField, null);
});

test('our match is next in line when the one before it is on the field', () => {
  const schedule = [qual(1, [1, 2, 3, 4], true), qual(2, [18833, 5, 6, 7], false)];
  assert.equal(buildMatches(schedule, 18833, {}).nextMatch.matchesBefore, 0);
});

test('the field travels with the match', () => {
  const m = toMatch({ ...upcomingQual, field: '2' }, 18833);
  assert.equal(m.field, '2');
  assert.equal(toMatch(upcomingQual, 18833).field, null);
});

test('our match in progress is the current match, not the next one', () => {
  const inProgress = { ...upcomingQual, matchNumber: 4, description: 'Qualification 4', actualStartTime: 'x', postResultTime: null };
  const later = { ...upcomingQual, matchNumber: 9, description: 'Qualification 9' };
  const { currentMatch, nextMatch } = buildMatches([playedQual, inProgress, later], 18833, {});
  assert.equal(currentMatch.label, 'Q4');
  assert.equal(nextMatch.label, 'Q9');
  assert.equal(buildMatches([playedQual, later], 18833, {}).currentMatch, null, 'a finished match is not current');
});

test('match keys line up between the hybrid and the regular schedule', () => {
  const { matchKey } = require('../src/ftc/schedule');
  assert.equal(matchKey({ tournamentLevel: 'QUALIFICATION', series: 0, matchNumber: 7 }), matchKey({ tournamentLevel: 'qual', matchNumber: 7 }));
  assert.notEqual(matchKey({ tournamentLevel: 'PLAYOFF', series: 2, matchNumber: 1 }), matchKey({ tournamentLevel: 'PLAYOFF', series: 3, matchNumber: 1 }));
});
