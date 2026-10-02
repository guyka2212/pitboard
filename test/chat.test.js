const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatStore } = require('../src/alerts/chat');

test('text is cleaned and limited', () => {
  const chat = new ChatStore();
  assert.equal(chat.addOutgoing('d', 'line one\r\nline two\u0007').text, 'line one\nline two');
  assert.equal(chat.addOutgoing('d', ' \n '), null);
  assert.equal(chat.addOutgoing('d', 'x'.repeat(501)), null);
  assert.equal(chat.addOutgoing('d', 42), null);
});

test('threads keep the latest 200 messages', () => {
  const chat = new ChatStore();
  for (let i = 0; i < 205; i += 1) chat.addOutgoing('d', `m${i}`);
  const messages = chat.messages('d');
  assert.equal(messages.length, 200);
  assert.equal(messages[0].text, 'm5');
});

test('delivery, read and unread tracking', () => {
  const chat = new ChatStore();
  const out = chat.addOutgoing('d', 'hello');
  assert.deepEqual(chat.undelivered('d').map((m) => m.id), [out.id]);
  assert.equal(chat.markRead('d', [out.id]), true);
  assert.equal(chat.undelivered('d').length, 0, 'read implies delivered');

  chat.addIncoming('d', 'in-1-aaaa', 'yo');
  assert.equal(chat.addIncoming('d', 'in-1-aaaa', 'yo'), null);
  assert.equal(chat.unread('d'), 1);
  assert.equal(chat.markSeen('d'), true);
  assert.equal(chat.unread('d'), 0);
  chat.remove('d');
  assert.equal(chat.messages('d').length, 0);
});
