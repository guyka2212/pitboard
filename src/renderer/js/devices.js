import { $, el, icon } from './dom.js';
import { clock } from './format.js';

const COOLDOWN_MS = 1500;

export function renderServerStatus({ serverStatus, devices }) {
  const box = $('server-status');
  box.classList.toggle('error', Boolean(serverStatus && serverStatus.error));
  const online = devices.filter((d) => d.online).length;
  if (!serverStatus) box.textContent = '';
  else if (serverStatus.error) box.textContent = `השרת לא פעיל: ${serverStatus.error}`;
  else if (serverStatus.running) box.textContent = `פורט ${serverStatus.port} · ${online} מחוברים`;
  else box.textContent = 'השרת כבוי';
}

function alertState(device) {
  if (device.lastAlert && device.lastAlert.ackAt) {
    return el('span', { class: 'd-state acked' }, icon('check', 14), `אישר ${clock(device.lastAlert.ackAt)}`);
  }
  if (!device.online) return el('span', { class: 'd-state' }, 'מנותק');
  if (device.lastAlert) return el('span', { class: 'd-state' }, `נשלח ${clock(device.lastAlert.sentAt)}`);
  return el('span', { class: 'd-state' });
}

// Guards against double clicks. The main process enforces its own per-device limit too.
export function cooldown(button, onDone = () => {}) {
  button.disabled = true;
  button.dataset.cooling = 'true';
  setTimeout(() => {
    delete button.dataset.cooling;
    onDone();
  }, COOLDOWN_MS);
}

function updateAlertAllButton(devices) {
  const button = $('btn-alert-all');
  button.disabled = button.dataset.cooling === 'true' || !devices.some((d) => d.online);
}

export function renderDevices(state, { onAlert, onRemove }) {
  const list = $('devices');
  list.replaceChildren();
  updateAlertAllButton(state.devices);
  renderServerStatus(state);

  if (!state.devices.length) {
    list.append(el('li', { class: 'empty-note' }, 'אף טלפון עוד לא התחבר. באפליקציה בטלפון מזינים את כתובת השרת ואת קוד ההצטרפות.'));
    return;
  }

  for (const device of state.devices) {
    const alertButton = el('button', { class: 'alert-btn', disabled: !device.online }, 'התראה');
    alertButton.addEventListener('click', () => {
      cooldown(alertButton, () => {
        alertButton.disabled = !device.online;
      });
      onAlert(device.id);
    });
    list.append(
      el('li', { class: `device${device.online ? ' online' : ''}` },
        el('span', { class: 'dot' }),
        el('span', { class: 'd-name' }, device.name),
        alertState(device),
        alertButton,
        !device.online &&
          el('button', { class: 'remove-btn', title: 'הסרה מהרשימה', 'aria-label': 'הסרה', onclick: () => onRemove(device.id) }, icon('close', 16)),
      ),
    );
  }
}
