const { ipcMain, clipboard } = require('electron');
const { validate } = require('../settings/schema');
const { seasonForDate } = require('../ftc/schedule');
const checklist = require('./checklist');
const { localIPv4Addresses } = require('./network');
const scout = require('../scout/service');
const { MAX_TEXT: MAX_CHAT_TEXT } = require('../alerts/chat');

const ALERT_COOLDOWN_MS = 1500;
const DATA_FIELDS = ['teamNumber', 'season', 'eventCode', 'demoMode'];

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** Only accept calls from our own page, not from anything that might get loaded later. */
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith('file://')) {
      throw new Error(`blocked ${channel} from ${event.senderFrame && event.senderFrame.url}`);
    }
    return fn(...args);
  });
}

function registerIpc({ state, store, alertServer, dashboard }) {
  const lastAlertAt = new Map();

  const persist = () => store.save(state.settings, state.checklistState);

  function publicState() {
    return {
      settings: state.settings,
      seasonGuess: seasonForDate(),
      dashboard: dashboard.state,
      checklistState: state.checklistState,
      devices: alertServer.listDevices(),
      serverStatus: alertServer.status,
      addresses: localIPv4Addresses(),
    };
  }

  handle('get-state', publicState);

  handle('save-settings', async (input) => {
    const { settings, errors } = validate(input, state.settings);
    if (Object.keys(errors).length) return { ok: false, errors };

    const previous = state.settings;
    state.settings = settings;
    const dataChanged = DATA_FIELDS.some((k) => settings[k] !== previous[k]);
    if (dataChanged) state.checklistState = { matchKey: null, checked: state.checklistState.checked };
    persist();

    alertServer.configure({ joinCode: settings.joinCode, teamNumber: settings.teamNumber });
    if (settings.serverPort !== previous.serverPort || !alertServer.status.running) {
      await alertServer.start(settings.serverPort);
    }
    if (dataChanged) dashboard.settingsChanged();
    else dashboard.refresh();
    return { ok: true, settings };
  });

  handle('refresh', () => dashboard.refresh());

  handle('toggle-check', (itemId, checked) => {
    const validIds = new Set(state.settings.checklist.map((i) => i.id));
    if (!validIds.has(itemId) || typeof checked !== 'boolean') return state.checklistState;
    state.checklistState = checklist.setChecked(state.checklistState, itemId, checked, validIds);
    persist();
    return state.checklistState;
  });

  handle('reset-checklist', () => {
    state.checklistState = checklist.cleared(state.checklistState);
    persist();
    return state.checklistState;
  });

  handle('send-alert', (deviceId) => {
    if (!isId(deviceId)) return false;
    const now = Date.now();
    if (now - (lastAlertAt.get(deviceId) || 0) < ALERT_COOLDOWN_MS) return false;
    lastAlertAt.set(deviceId, now);
    return alertServer.alert(deviceId, state.settings.alertMessage);
  });

  handle('send-alert-all', () => alertServer.alertAll(state.settings.alertMessage));

  handle('remove-device', (deviceId) => isId(deviceId) && alertServer.removeDevice(deviceId));

  handle('chat-thread', (deviceId) => (isId(deviceId) ? alertServer.chatThread(deviceId) : null));

  handle('chat-send', (deviceId, text) => {
    if (!isId(deviceId)) return { ok: false, error: 'לא נבחר נמען' };
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'ההודעה ריקה' };
    if (text.length > MAX_CHAT_TEXT) return { ok: false, error: `עד ${MAX_CHAT_TEXT} תווים` };
    const message = alertServer.sendChat(deviceId, text);
    return message ? { ok: true, message } : { ok: false, error: 'הטלפון הוסר מהרשימה' };
  });

  handle('copy-text', (text) => {
    if (typeof text === 'string' && text.length <= 200) clipboard.writeText(text);
  });

  handle('get-addresses', localIPv4Addresses);

  // Scout calls answer { ok, ... } instead of throwing: Electron would prefix thrown
  // messages with its own text, and the window shows these errors as they are.
  function scoutContext() {
    const data = dashboard.state.data;
    if (state.settings.demoMode) return { error: 'סקאוטינג לא זמין במצב הדגמה' };
    return { data, season: (data && data.season) || Number(state.settings.season) || seasonForDate() };
  }

  handle('scout-event', async () => {
    const { error, data, season } = scoutContext();
    if (error) return { ok: false, error };
    if (!data || !data.event) return { ok: false, error: 'אין עדיין אירוע לקבוצה, אז אין מה לסקאוט' };
    try {
      const table = await scout.eventTable({ season, eventCode: data.event.code, teams: data.eventTeams || [] });
      return { ok: true, event: data.event, table };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  handle('scout-team', async (number) => {
    const { error, data, season } = scoutContext();
    if (error) return { ok: false, error };
    try {
      const card = await scout.teamCard({ number, season, eventCode: data && data.event && data.event.code });
      return { ok: true, card };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerIpc };
