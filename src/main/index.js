const path = require('path');
const { app, BrowserWindow, Menu, Notification, session } = require('electron');
const store = require('../settings/store');
const { AlertServer } = require('../alerts/server');
const { DashboardService } = require('./dashboard-service');
const { registerIpc } = require('./ipc');
const checklist = require('./checklist');
const { MatchAlert, describe } = require('./match-alert');

const ICON = path.join(__dirname, '..', '..', 'build', 'icon.ico');

const state = { settings: null, checklistState: null };
const alertServer = new AlertServer();
const dashboard = new DashboardService({
  getSettings: () => state.settings,
  getCredentials: store.credentials,
});
const matchAlert = new MatchAlert();
let win = null;

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// The window may be minimized or behind other windows in the pit, so use every channel we have.
function announceMatch(match) {
  const text = describe(match);
  // On start-up the first data can arrive before the page is listening.
  if (win && win.webContents.isLoading()) win.webContents.once('did-finish-load', () => send('match-soon', { match, ...text }));
  else send('match-soon', { match, ...text });
  if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true);
  if (Notification.isSupported()) {
    const notification = new Notification({ title: text.title, body: text.body, icon: ICON, urgency: 'critical' });
    notification.on('click', () => {
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    notification.show();
  }
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
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // the match alert has to make sound even if nobody has clicked the window yet
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.on('focus', () => win.flashFrame(false));

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
  alertServer.on('chat', (thread) => send('chat', thread));
  alertServer.on('chat-message', ({ deviceId, name, message }) => {
    send('chat-message', { deviceId, name, text: message.text });
    if (!win || win.isDestroyed() || win.isFocused()) return;
    win.flashFrame(true);
    if (Notification.isSupported()) {
      const notification = new Notification({ title: `הודעה מ${name}`, body: message.text, icon: ICON });
      notification.on('click', () => {
        if (win.isMinimized()) win.restore();
        win.focus();
        send('open-chat', deviceId);
      });
      notification.show();
    }
  });
  dashboard.on('dashboard', (snapshot) => {
    send('dashboard', snapshot);
    const soon = snapshot.status === 'ok' && matchAlert.check(snapshot.data);
    if (soon) announceMatch(soon);
  });
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
  // Windows only shows toast notifications for apps with an id; it must match build.appId.
  app.setAppUserModelId('org.ftc.pitboard');
  app.whenReady().then(start);
}
