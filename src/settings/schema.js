const crypto = require('crypto');

const MAX_CHECKLIST_ITEMS = 50;
const MAX_TEXT = 120;

const DEFAULT_CHECKLIST = [
  'סוללה טעונה ומחוברת',
  'Driver Hub טעון ומחובר לרובוט',
  'בקרים מחוברים ומוגדרים',
  'קוד אוטונומי נבחר',
  'ברגים ומחברים נבדקו',
  'דגל הקבוצה / סימון הצבע על הרובוט',
];

class FieldError extends Error {}

const newId = () => crypto.randomBytes(6).toString('hex');

// No 0/O/1/I so the code is easy to read off the screen and type on a phone.
function generateJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

function defaults() {
  return {
    teamNumber: '',
    season: '',
    eventCode: '',
    refreshSeconds: 60,
    serverPort: 8765,
    joinCode: generateJoinCode(),
    alertMessage: 'בואו לפיט עכשיו!',
    demoMode: false,
    checklist: DEFAULT_CHECKLIST.map((text) => ({ id: newId(), text })),
  };
}

const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

function intInRange(v, min, max, message) {
  const s = str(v);
  if (!/^\d+$/.test(s)) throw new FieldError(message);
  const n = Number(s);
  if (n < min || n > max) throw new FieldError(message);
  return n;
}

const FIELDS = {
  teamNumber(v) {
    const s = str(v);
    if (s === '') throw new FieldError('צריך להזין את מספר הקבוצה');
    if (!/^\d{1,5}$/.test(s) || Number(s) === 0) throw new FieldError('מספר קבוצה הוא 1 עד 5 ספרות');
    return String(Number(s));
  },
  season(v) {
    const s = str(v);
    if (s === '') return '';
    const year = Number(s);
    if (!/^\d{4}$/.test(s) || year < 2019 || year > new Date().getFullYear() + 1) {
      throw new FieldError('עונה היא שנה בת 4 ספרות (למשל 2026), או ריק לבחירה אוטומטית');
    }
    return s;
  },
  eventCode(v) {
    const s = str(v).toUpperCase();
    if (s !== '' && !/^[A-Z0-9]{3,20}$/.test(s)) throw new FieldError('קוד אירוע הוא 3–20 אותיות באנגלית וספרות');
    return s;
  },
  refreshSeconds: (v) => intInRange(v, 15, 3600, 'רענון: בין 15 ל-3600 שניות'),
  serverPort: (v) => intInRange(v, 1024, 65535, 'פורט: בין 1024 ל-65535'),
  joinCode(v) {
    const s = str(v).toUpperCase();
    if (!/^[A-Z0-9]{0,32}$/.test(s)) throw new FieldError('קוד הצטרפות: אותיות באנגלית וספרות בלבד');
    return s;
  },
  alertMessage(v) {
    const s = str(v);
    if (s.length > MAX_TEXT) throw new FieldError(`הודעה עד ${MAX_TEXT} תווים`);
    return s || 'בואו לפיט עכשיו!';
  },
  demoMode: (v) => v === true || v === 'true' || v === 'on',
  checklist(v, previous = []) {
    if (!Array.isArray(v)) throw new FieldError('רשימה לא תקינה');
    const texts = v.map((item) => str(typeof item === 'object' && item ? item.text : item)).filter(Boolean);
    if (texts.length > MAX_CHECKLIST_ITEMS) throw new FieldError(`עד ${MAX_CHECKLIST_ITEMS} פריטים`);
    if (texts.some((t) => t.length > MAX_TEXT)) throw new FieldError(`כל פריט עד ${MAX_TEXT} תווים`);
    // Keep ids of unchanged items so their checked state survives an edit.
    const unusedIds = new Map();
    for (const item of previous) {
      if (!unusedIds.has(item.text)) unusedIds.set(item.text, []);
      unusedIds.get(item.text).push(item.id);
    }
    return texts.map((text) => ({ id: unusedIds.get(text)?.shift() || newId(), text }));
  },
};

/**
 * Validates the fields present in `input` on top of `base`.
 * Returns the merged settings and a map of field -> error message (empty when valid).
 */
function validate(input, base) {
  const settings = { ...base };
  const errors = {};
  if (!input || typeof input !== 'object') return { settings, errors: { form: 'קלט לא תקין' } };

  for (const [key, check] of Object.entries(FIELDS)) {
    if (!(key in input)) continue;
    try {
      settings[key] = check(input[key], base[key]);
    } catch (err) {
      if (!(err instanceof FieldError)) throw err;
      errors[key] = err.message;
    }
  }
  return { settings, errors };
}

module.exports = { defaults, validate, generateJoinCode };
