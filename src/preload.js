const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel) => (callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('hub', {
  getState: () => ipcRenderer.invoke('get-state'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  refresh: () => ipcRenderer.invoke('refresh'),
  toggleCheck: (itemId, checked) => ipcRenderer.invoke('toggle-check', itemId, checked),
  resetChecklist: () => ipcRenderer.invoke('reset-checklist'),
  sendAlert: (deviceId) => ipcRenderer.invoke('send-alert', deviceId),
  sendAlertAll: () => ipcRenderer.invoke('send-alert-all'),
  removeDevice: (deviceId) => ipcRenderer.invoke('remove-device', deviceId),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  getAddresses: () => ipcRenderer.invoke('get-addresses'),
  scoutEvent: () => ipcRenderer.invoke('scout-event'),
  scoutTeam: (number) => ipcRenderer.invoke('scout-team', number),
  onMatchSoon: subscribe('match-soon'),
  chatThread: (deviceId) => ipcRenderer.invoke('chat-thread', deviceId),
  chatSend: (deviceId, text) => ipcRenderer.invoke('chat-send', deviceId, text),
  onChat: subscribe('chat'),
  onChatMessage: subscribe('chat-message'),
  onOpenChat: subscribe('open-chat'),
  onDashboard: subscribe('dashboard'),
  onChecklist: subscribe('checklist'),
  onDevices: subscribe('devices'),
  onServerStatus: subscribe('server-status'),
});
