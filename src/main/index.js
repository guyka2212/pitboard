const path = require('path');
const { app, BrowserWindow, Menu, session } = require('electron');
const store = require('../settings/store');
const { AlertServer } = require('../alerts/server');
const { DashboardService } = require('./dashboard-service');
const { registerIpc } = require('./ipc');
const checklist = require('./checklist');

const state = { settings: null, checklistState: null };
const alertServer = new AlertServer();
const dashboard = new DashboardService({
  getSettings: () => state.settings,
  getCredentials: store.credentials,
});
let win = null;

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    // same color as the loading screen, so nothing flashes before the page paints
    backgroundColor: '#12151C',
    title: 'PitBoard',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
  win.on('closed', () => {
    win = null;
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

async function start() {
  Object.assign(state, store.load());
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  registerIpc({ state, store, alertServer, dashboard });
  createWindow();

  alertServer.on('devices', (devices) => send('devices', devices));
  alertServer.on('status', (status) => send('server-status', status));
  dashboard.on('dashboard', (snapshot) => send('dashboard', snapshot));
  dashboard.on('next-match', (key) => {
    const next = checklist.forNextMatch(state.checklistState, key);
    if (next === state.checklistState) return;
    state.checklistState = next;
    store.save(state.settings, state.checklistState);
    send('checklist', next);
  });

  alertServer.configure({ joinCode: state.settings.joinCode, teamNumber: state.settings.teamNumber });
  await alertServer.start(state.settings.serverPort);
  dashboard.refresh();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    dashboard.stop();
    alertServer.stop();
  });
  app.whenReady().then(start);
}
