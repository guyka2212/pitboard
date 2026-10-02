const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, validate, generateJoinCode } = require('../src/settings/schema');

test('there is no default team; everything else in the defaults is valid', () => {
  const base = defaults();
  assert.equal(base.teamNumber, '');
  assert.match(base.joinCode, /^[A-Z2-9]{6}$/);
  assert.deepEqual(Object.keys(validate(base, base).errors), ['teamNumber']);
  assert.deepEqual(validate({ ...base, teamNumber: '18833' }, base).errors, {});
});

test('the team number is required', () => {
  assert.match(validate({ teamNumber: '   ' }, defaults()).errors.teamNumber, /צריך/);
});

test('API credentials cannot be set through settings', () => {
  const { settings } = validate({ apiUsername: 'someone', apiKey: 'ABCDEF12-0000' }, defaults());
  assert.equal('apiUsername' in settings, false);
  assert.equal('apiKey' in settings, false);
});

test('join codes avoid look-alike characters', () => {
  for (let i = 0; i < 200; i += 1) assert.doesNotMatch(generateJoinCode(), /[01OI]/);
});

test('any team number of 1-5 digits is accepted', () => {
  const base = defaults();
  for (const n of ['1', '724', '18833', '99999', ' 4321 ']) {
    assert.deepEqual(validate({ teamNumber: n }, base).errors, {}, n);
  }
  assert.equal(validate({ teamNumber: '007' }, base).settings.teamNumber, '7');
});

test('bad team numbers are rejected and the old value is kept', () => {
  const base = defaults();
  for (const n of ['', '0', '123456', '12a', '-5', '1.5', null, {}, ['1']]) {
    const { settings, errors } = validate({ teamNumber: n }, base);
    assert.ok(errors.teamNumber, String(n));
    assert.equal(settings.teamNumber, base.teamNumber);
  }
});

test('event code is normalized and validated', () => {
  const base = defaults();
  assert.equal(validate({ eventCode: ' ilcmp ' }, base).settings.eventCode, 'ILCMP');
  assert.ok(validate({ eventCode: 'IL' }, base).errors.eventCode);
  assert.ok(validate({ eventCode: 'IL CMP' }, base).errors.eventCode);
  assert.ok(validate({ eventCode: '<script>' }, base).errors.eventCode);
});

test('numbers must be in range', () => {
  const base = defaults();
  assert.ok(validate({ serverPort: '80' }, base).errors.serverPort);
  assert.ok(validate({ serverPort: '70000' }, base).errors.serverPort);
  assert.ok(validate({ refreshSeconds: '5' }, base).errors.refreshSeconds);
  assert.ok(validate({ refreshSeconds: 'abc' }, base).errors.refreshSeconds);
  assert.equal(validate({ serverPort: '9000' }, base).settings.serverPort, 9000);
});

test('checklist keeps ids of unchanged items, including duplicates', () => {
  const base = { ...defaults(), checklist: [{ id: 'a', text: 'Battery' }, { id: 'b', text: 'Battery' }, { id: 'c', text: 'Code' }] };
  const { settings } = validate({ checklist: ['Code', 'Battery', '', '  ', 'Battery', 'New'] }, base);
  assert.deepEqual(settings.checklist.slice(0, 3).map((i) => i.id), ['c', 'a', 'b']);
  assert.equal(settings.checklist.length, 4);
  assert.ok(!['a', 'b', 'c'].includes(settings.checklist[3].id));
});

test('checklist limits', () => {
  const base = defaults();
  assert.ok(validate({ checklist: Array(51).fill('x').map((x, i) => x + i) }, base).errors.checklist);
  assert.ok(validate({ checklist: ['x'.repeat(121)] }, base).errors.checklist);
  assert.ok(validate({ checklist: 'not an array' }, base).errors.checklist);
});

test('non-object input is rejected', () => {
  assert.ok(validate(null, defaults()).errors.form);
  assert.ok(validate('teamNumber=1', defaults()).errors.form);
});
