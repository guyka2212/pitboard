import { $, icon } from './dom.js';
import { renderHeader, renderBanner } from './header.js';
import { renderNextMatch } from './next-match.js';
import { renderMatchList } from './match-list.js';
import { renderChecklist } from './checklist.js';
import { renderDevices, renderServerStatus, cooldown } from './devices.js';
import { initSettingsDialog, openSettings, renderServerBox } from './settings-dialog.js';
import { hideSplash, setSplashStatus } from './splash.js';

const { hub } = window;

const state = {
  settings: null,
  seasonGuess: null,
  dashboard: null,
  checklistState: { matchKey: null, checked: [] },
  devices: [],
  serverStatus: null,
  addresses: [],
};

const deviceActions = { onAlert: (id) => hub.sendAlert(id), onRemove: (id) => hub.removeDevice(id) };
const checklistActions = { onToggle: (id, checked) => hub.toggleCheck(id, checked) };

function renderDashboard() {
  renderHeader(state);
  renderNextMatch(state);
  renderMatchList(state);
  renderBanner(state);
}

function renderAll() {
  renderDashboard();
  renderChecklist(state, checklistActions);
  renderDevices(state, deviceActions);
}

let promptedForSettings = false;
function afterDashboardUpdate() {
  const status = state.dashboard && state.dashboard.status;
  if (status === 'loading') {
    setSplashStatus('מביא נתונים מ-FTC…');
    return;
  }
  const splashGone = hideSplash();
  // First run: there is no team number yet, so ask for it once the logo has had its moment.
  if (status === 'unconfigured' && !promptedForSettings) {
    promptedForSettings = true;
    splashGone.then(() => {
      if (!$('settings').open) openSettings(state);
    });
  }
}

function wireControls() {
  $('btn-refresh').append(icon('refresh'));
  $('btn-settings').append(icon('settings'));
  $('btn-refresh').addEventListener('click', () => hub.refresh());
  $('btn-settings').addEventListener('click', () => openSettings(state));
  $('btn-alert-all').addEventListener('click', () => {
    cooldown($('btn-alert-all'), () => renderDevices(state, deviceActions));
    hub.sendAlertAll();
  });
  $('btn-reset-checklist').addEventListener('click', async () => {
    state.checklistState = await hub.resetChecklist();
    renderChecklist(state, checklistActions);
  });
  initSettingsDialog(state, { onSaved: renderAll });
}

// Subscribe before asking for the initial state so no update is missed in between;
// updates that arrive before it are stored and drawn by the first renderAll().
function subscribe() {
  const ready = () => state.settings !== null;
  hub.onDashboard((snapshot) => {
    state.dashboard = snapshot;
    if (!ready()) return;
    renderDashboard();
    afterDashboardUpdate();
  });
  hub.onChecklist((checklistState) => {
    state.checklistState = checklistState;
    if (ready()) renderChecklist(state, checklistActions);
  });
  hub.onDevices((devices) => {
    state.devices = devices;
    if (ready()) renderDevices(state, deviceActions);
  });
  hub.onServerStatus((serverStatus) => {
    state.serverStatus = serverStatus;
    if (!ready()) return;
    renderServerStatus(state);
    renderServerBox(state);
  });
}

async function init() {
  wireControls();
  subscribe();
  Object.assign(state, await hub.getState());
  renderAll();
  afterDashboardUpdate();
}

init();
