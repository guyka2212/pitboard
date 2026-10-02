import { $, el, icon } from './dom.js';
import { clock } from './format.js';

const MAX_TEXT = 500;
const view = { selectedId: null, messages: [], sending: false };

const dialog = () => $('chat');
const isOpen = () => dialog().open;

export const totalUnread = (devices) => devices.reduce((sum, d) => sum + (d.unread || 0), 0);

export function renderChatBadge(state) {
  const count = totalUnread(state.devices);
  const badge = $('chat-badge');
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
  $('btn-chat').setAttribute('aria-label', count ? `צ'אט, ${count} הודעות שלא נקראו` : "צ'אט");
}

function renderPeople(state) {
  const list = $('chat-people');
  list.replaceChildren();
  if (!state.devices.length) {
    list.append(el('li', { class: 'empty-note' }, 'אף טלפון עוד לא התחבר.'));
    return;
  }
  for (const device of state.devices) {
    const button = el('button', {
      type: 'button',
      class: `chat-person${device.id === view.selectedId ? ' active' : ''}${device.online ? ' online' : ''}`,
      'aria-current': device.id === view.selectedId ? 'true' : 'false',
    },
      el('span', { class: 'dot' }),
      el('span', { class: 'cp-name' }, device.name),
      device.unread > 0 && el('span', { class: 'badge' }, String(device.unread)),
    );
    button.addEventListener('click', () => select(state, device.id));
    list.append(el('li', {}, button));
  }
}

const STATUS_LABEL = { read: 'נקרא', delivered: 'נמסר', pending: 'ממתין' };

function statusOf(message) {
  if (message.readAt) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'pending';
}

function renderThread(state) {
  const device = state.devices.find((d) => d.id === view.selectedId);
  const thread = $('chat-thread');
  const compose = $('chat-text');
  thread.replaceChildren();
  $('chat-with').textContent = device ? device.name : '';
  $('chat-offline').hidden = !device || device.online;
  compose.disabled = !device;
  $('chat-send').disabled = !device || view.sending;

  if (!device) {
    thread.append(el('p', { class: 'empty-note chat-empty' }, state.devices.length ? 'בוחרים למי לכתוב' : ''));
    return;
  }
  if (!view.messages.length) {
    thread.append(el('p', { class: 'empty-note chat-empty' }, `עוד אין הודעות עם ${device.name}`));
  }
  for (const message of view.messages) {
    const out = message.direction === 'out';
    const status = out && statusOf(message);
    thread.append(
      el('div', { class: `bubble ${out ? 'out' : 'in'}` },
        el('div', { class: 'bubble-text', dir: 'auto' }, message.text),
        el('div', { class: 'bubble-meta' },
          clock(message.sentAt),
          out && el('span', { class: `tick ${status}` }, status !== 'pending' && icon('check', 12), STATUS_LABEL[status])),
      ),
    );
  }
  thread.scrollTop = thread.scrollHeight;
}

async function select(state, deviceId) {
  view.selectedId = deviceId;
  view.messages = (await window.hub.chatThread(deviceId)) || [];
  renderPeople(state);
  renderThread(state);
  $('chat-text').focus();
}

function updateCounter() {
  const length = $('chat-text').value.length;
  const counter = $('chat-count');
  counter.textContent = length > MAX_TEXT - 100 ? `${length}/${MAX_TEXT}` : '';
  counter.classList.toggle('over', length > MAX_TEXT);
}

async function send(state) {
  const input = $('chat-text');
  const text = input.value;
  if (!view.selectedId || view.sending || !text.trim()) return;
  view.sending = true;
  $('chat-error').textContent = '';
  renderThread(state);
  try {
    const result = await window.hub.chatSend(view.selectedId, text);
    if (!result.ok) {
      $('chat-error').textContent = result.error;
      return;
    }
    input.value = '';
    updateCounter();
  } catch (err) {
    $('chat-error').textContent = `השליחה נכשלה: ${err.message}`;
  } finally {
    view.sending = false;
    renderThread(state);
    input.focus();
  }
}

/** Opens the chat, on `deviceId` or else on whoever wrote last / the first phone. */
export function openChat(state, deviceId) {
  if (!isOpen()) dialog().showModal();
  $('chat-error').textContent = '';
  const target = deviceId
    || (state.devices.find((d) => d.id === view.selectedId) && view.selectedId)
    || (state.devices.find((d) => d.unread > 0) || state.devices[0] || {}).id;
  if (target) select(state, target);
  else {
    view.selectedId = null;
    view.messages = [];
    renderPeople(state);
    renderThread(state);
  }
}

/** A thread changed in the main process. */
export function chatUpdated(state, { deviceId, messages }) {
  if (!isOpen() || deviceId !== view.selectedId) return;
  view.messages = messages;
  renderThread(state);
  // We're looking at it, so incoming messages count as seen.
  if (messages.some((m) => m.direction === 'in' && !m.seen)) window.hub.chatThread(deviceId);
}

/** The phone list changed (online state, names, unread counts). */
export function chatDevicesChanged(state) {
  renderChatBadge(state);
  if (!isOpen()) return;
  if (view.selectedId && !state.devices.some((d) => d.id === view.selectedId)) {
    view.selectedId = null;
    view.messages = [];
  }
  renderPeople(state);
  renderThread(state);
}

export function isViewing(deviceId) {
  return isOpen() && view.selectedId === deviceId && document.hasFocus();
}

export function initChatDialog(state) {
  $('chat-close').append(icon('close'));
  $('chat-send').append(icon('send', 18));
  $('chat-close').addEventListener('click', () => dialog().close());
  $('chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    send(state);
  });
  $('chat-text').addEventListener('input', updateCounter);
  $('chat-text').addEventListener('keydown', (event) => {
    // Enter sends, Shift+Enter adds a line, like most chat apps.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send(state);
    }
  });
}
