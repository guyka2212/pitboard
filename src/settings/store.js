const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { defaults, validate } = require('./schema');

const CREDENTIALS_FILE = path.join(__dirname, '..', '..', 'ftc-credentials.json');

const filePath = () => path.join(app.getPath('userData'), 'settings.json');

function readCredentials() {
  try {
    const c = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    if (typeof c.apiUsername === 'string' && typeof c.apiKey === 'string' && c.apiUsername && c.apiKey) {
      return { apiUsername: c.apiUsername, apiKey: c.apiKey };
    }
  } catch {
    // reported to the user as a missing account
  }
  return null;
}

// The FTC API account ships with the app; it is never shown in or changed from the UI.
const credentials = readCredentials();

function readChecklistState(raw) {
  const ok = raw && (raw.matchKey === null || typeof raw.matchKey === 'string') && Array.isArray(raw.checked);
  return ok
    ? { matchKey: raw.matchKey, checked: raw.checked.filter((id) => typeof id === 'string') }
    : { matchKey: null, checked: [] };
}

function load() {
  let stored = null;
  try {
    stored = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('settings.json is unreadable, starting from defaults:', err.message);
  }

  const base = defaults();
  if (!stored || typeof stored !== 'object') {
    const fresh = { settings: base, checklistState: readChecklistState(null) };
    save(fresh.settings, fresh.checklistState);
    return fresh;
  }

  // validate() only copies valid fields, so bad values in a hand-edited file fall back to defaults.
  const { checklistState, ...fields } = stored;
  const { settings } = validate(fields, base);
  return { settings, checklistState: readChecklistState(checklistState) };
}

function save(settings, checklistState) {
  const target = filePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // write-then-rename so a crash mid-write can't leave a half-written settings file
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...settings, checklistState }, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

module.exports = { load, save, credentials: () => credentials };
