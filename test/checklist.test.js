const test = require('node:test');
const assert = require('node:assert/strict');
const { forNextMatch, setChecked, cleared } = require('../src/main/checklist');

test('checklist resets when the next match changes', () => {
  const state = { matchKey: 'qual-0-12', checked: ['a', 'b'] };
  assert.equal(forNextMatch(state, 'qual-0-12'), state);
  assert.deepEqual(forNextMatch(state, 'qual-0-18'), { matchKey: 'qual-0-18', checked: [] });
});

test('progress survives a restart (no match known yet)', () => {
  assert.deepEqual(forNextMatch({ matchKey: null, checked: ['a'] }, 'qual-0-3'), { matchKey: 'qual-0-3', checked: ['a'] });
});

test('setChecked drops ids of items that no longer exist', () => {
  const state = { matchKey: 'm', checked: ['old', 'a'] };
  const next = setChecked(state, 'b', true, new Set(['a', 'b']));
  assert.deepEqual(next.checked.sort(), ['a', 'b']);
  assert.deepEqual(setChecked(next, 'a', false, new Set(['a', 'b'])).checked, ['b']);
  assert.deepEqual(cleared(next), { matchKey: 'm', checked: [] });
});
