// Chat threads between the pit laptop and each phone. Kept in memory: a pit chat
// only matters during the event, and phones keep their own copy.
const crypto = require('crypto');

const MAX_TEXT = 500;
const MAX_PER_THREAD = 200;

function cleanText(text) {
  if (typeof text !== 'string') return '';
  // Keep line breaks, drop other control characters.
  return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
}

class ChatStore {
  constructor() {
    this.threads = new Map();
  }

  thread(deviceId) {
    if (!this.threads.has(deviceId)) this.threads.set(deviceId, []);
    return this.threads.get(deviceId);
  }

  push(deviceId, message) {
    const list = this.thread(deviceId);
    list.push(message);
    if (list.length > MAX_PER_THREAD) list.splice(0, list.length - MAX_PER_THREAD);
    return message;
  }

  /** A message from the laptop. Returns null when the text is empty or too long. */
  addOutgoing(deviceId, text) {
    const clean = cleanText(text);
    if (!clean || clean.length > MAX_TEXT) return null;
    return this.push(deviceId, {
      id: crypto.randomUUID(),
      direction: 'out',
      text: clean,
      sentAt: Date.now(),
      deliveredAt: null,
      readAt: null,
    });
  }

  /** A message from a phone. Phones may resend after a reconnect, so duplicates are ignored. */
  addIncoming(deviceId, id, text) {
    const clean = cleanText(text);
    if (!clean || clean.length > MAX_TEXT) return null;
    if (this.thread(deviceId).some((m) => m.id === id)) return null;
    return this.push(deviceId, { id, direction: 'in', text: clean, sentAt: Date.now(), seen: false });
  }

  markDelivered(deviceId, id) {
    const message = this.thread(deviceId).find((m) => m.id === id && m.direction === 'out');
    if (!message || message.deliveredAt) return false;
    message.deliveredAt = Date.now();
    return true;
  }

  markRead(deviceId, ids) {
    let changed = false;
    const now = Date.now();
    for (const message of this.thread(deviceId)) {
      if (message.direction !== 'out' || !ids.includes(message.id)) continue;
      if (!message.deliveredAt) message.deliveredAt = now;
      if (!message.readAt) {
        message.readAt = now;
        changed = true;
      }
    }
    return changed;
  }

  /** The pit opened this conversation: its incoming messages are no longer unread. */
  markSeen(deviceId) {
    let changed = false;
    for (const message of this.thread(deviceId)) {
      if (message.direction === 'in' && !message.seen) {
        message.seen = true;
        changed = true;
      }
    }
    return changed;
  }

  undelivered(deviceId) {
    return this.thread(deviceId).filter((m) => m.direction === 'out' && !m.deliveredAt);
  }

  unread(deviceId) {
    return this.thread(deviceId).filter((m) => m.direction === 'in' && !m.seen).length;
  }

  messages(deviceId) {
    return this.thread(deviceId).map((m) => ({ ...m }));
  }

  remove(deviceId) {
    this.threads.delete(deviceId);
  }
}

module.exports = { ChatStore, MAX_TEXT };
