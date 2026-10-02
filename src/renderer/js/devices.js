import { $, el, icon } from './dom.js';
import { clock } from './format.js';

const COOLDOWN_MS = 1500;

export function renderServerStatus({ serverStatus, devices }) {
  const box = $('server-status');
  box.classList.toggle('error', Boolean(serverStatus && serverStatus.error));
  const online = devices.filter((d) => d.online).length;
  if (!serverStatus) box.textContent = '';
  else if (serverStatus.error) box.textContent = `Server not running: ${serverStatus.error}`;
  else if (serverStatus.running) box.textContent = `Port ${serverStatus.port} · ${online} connected`;
  else box.textContent = 'Server is off';
}

function alertState(device) {
  if (device.lastAlert && device.lastAlert.ackAt) {
    return el('span', { class: 'd-state acked' }, icon('check', 14), `Confirmed ${clock(device.lastAlert.ackAt)}`);
  }
  if (!device.online) return el('span', { class: 'd-state' }, 'Offline');
  if (device.lastAlert) return el('span', { class: 'd-state' }, `Sent ${clock(device.lastAlert.sentAt)}`);
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

function chatButton(device, onChat) {
  return el('button', {
    class: 'chat-btn has-badge',
    title: `Chat with ${device.name}`,
    'aria-label': device.unread ? `Chat with ${device.name}, ${device.unread} new` : `Chat with ${device.name}`,
    onclick: () => onChat(device.id),
  }, icon('chat', 16), device.unread > 0 && el('span', { class: 'badge' }, String(device.unread)));
}

export function renderDevices(state, { onAlert, onRemove, onChat }) {
  const list = $('devices');
  list.replaceChildren();
  updateAlertAllButton(state.devices);
  renderServerStatus(state);

  if (!state.devices.length) {
    list.append(el('li', { class: 'empty-note' }, 'No phone has connected yet. In the phone app, enter the server address and the join code.'));
    return;
  }

  for (const device of state.devices) {
    const alertButton = el('button', { class: 'alert-btn', disabled: !device.online }, 'Alert');
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
        chatButton(device, onChat),
        alertButton,
        !device.online &&
          el('button', { class: 'remove-btn', title: 'Remove from the list', 'aria-label': 'Remove', onclick: () => onRemove(device.id) }, icon('close', 16)),
      ),
    );
  }
}
