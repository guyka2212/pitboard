const test = require('node:test');
const assert = require('node:assert/strict');
const { MatchAlert, describe } = require('../src/main/match-alert');

const data = (matchesBefore, key = 'qual-0-14') => ({
  teamNumber: 18833,
  event: { code: 'ILCMP' },
  nextMatch: {
    key,
    label: 'Q14',
    alliance: 'red',
    station: 'Red1',
    matchesBefore,
    partners: [{ display: '22222' }],
    opponents: [{ display: '88888' }, { display: '99999' }],
  },
});

test('alerts once when our match is two away, not before', () => {
  const alert = new MatchAlert();
  assert.equal(alert.check(data(3)), null);
  assert.equal(alert.check(data(2)).label, 'Q14');
  assert.equal(alert.check(data(1)), null, 'same match is announced only once');
  assert.equal(alert.check(data(2, 'qual-0-21')).key, 'qual-0-21');
});

test('ignores missing data', () => {
  const alert = new MatchAlert();
  assert.equal(alert.check(null), null);
  assert.equal(alert.check({ nextMatch: null }), null);
  assert.equal(alert.check({ nextMatch: { key: 'x' } }), null);
});

test('notification text', () => {
  assert.deepEqual(describe(data(2).nextMatch), { title: '2 matches until ours', body: 'Q14 · Red · with 22222' });
  assert.equal(describe(data(0).nextMatch).title, 'Our match is up next!');
});

test('notification names the field when there is one', () => {
  const match = { ...data(2).nextMatch, field: '2' };
  assert.equal(describe(match).body, 'Q14 · Red · Field 2 · with 22222');
});

test('no alert from data FTC has not updated today', () => {
  const alert = new MatchAlert();
  assert.equal(alert.check({ ...data(1), dataNotSyncedToday: true }), null);
  assert.equal(alert.check(data(1)).label, 'Q14', 'alerts once the data is current');
});
