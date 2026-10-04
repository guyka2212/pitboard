const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// The window's ES modules aren't loaded by the other tests, so at least make sure they parse.
const dir = path.join(__dirname, '..', 'src', 'renderer', 'js');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  test(`renderer/js/${file} parses`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: fs.readFileSync(path.join(dir, file)),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  });
}
