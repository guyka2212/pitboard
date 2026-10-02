const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const WebSocket = require('ws');
const { AlertServer, CLOSE } = require('../src/alerts/server');

async function startServer(t, joinCode = 'PIT123') {
  const server = new AlertServer();
  server.configure({ joinCode, teamNumber: '18833' });
  await server.start(0);
  t.after(() => server.stop());
  return { server, url: `ws://127.0.0.1:${server.status.port}/`, http: `http://127.0.0.1:${server.status.port}` };
}

/** Connects a fake phone and collects what it receives. */
function phone(url, hello, options) {
  const ws = new WebSocket(url, options);
  const messages = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    messages.push(msg);
    waiters.splice(0).forEach((w) => w());
  });
  if (hello) ws.on('open', () => ws.send(JSON.stringify(hello)));
  const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));
  ws.on('error', () => {});
  const next = (type) =>
    new Promise((resolve) => {
      const check = () => {
        const found = messages.find((m) => m.type === type);
        if (found) resolve(found);
        else waiters.push(check);
      };
      check();
    });
  return { ws, next, closed };
}

const hello = (name, extra = {}) => ({ type: 'hello', name, deviceId: crypto.randomUUID(), joinCode: 'PIT123', ...extra });

test('a phone joins, gets an alert and acknowledges it', async (t) => {
  const { server, url } = await startServer(t);
  const p = phone(url, hello('Noa'));
  const welcome = await p.next('welcome');
  assert.equal(welcome.teamNumber, '18833');

  const [device] = server.listDevices();
  assert.equal(device.name, 'Noa');
  assert.equal(device.online, true);

  assert.equal(server.alert(device.id, 'come to the pit'), true);
  const alert = await p.next('alert');
  assert.equal(alert.message, 'come to the pit');

  const acked = new Promise((resolve) => server.on('devices', (list) => list[0].lastAlert?.ackAt && resolve()));
  p.ws.send(JSON.stringify({ type: 'ack', alertId: alert.alertId }));
  await acked;
  p.ws.close();
});

test('join code is required and case-insensitive', async (t) => {
  const { url } = await startServer(t);
  const wrong = phone(url, hello('Eve', { joinCode: 'nope' }));
  assert.equal((await wrong.next('error')).code, 'bad_join_code');
  assert.equal(await wrong.closed, CLOSE.BAD_JOIN_CODE);

  const lower = phone(url, hello('Dan', { joinCode: 'pit123' }));
  await lower.next('welcome');
  lower.ws.close();
});

test('invalid hello messages are rejected', async (t) => {
  const { url } = await startServer(t);
  for (const bad of [hello(''), hello('x'.repeat(41)), hello('Dan', { deviceId: '../../etc' }), hello('Dan', { name: 42 })]) {
    const p = phone(url, bad);
    assert.equal(await p.closed, CLOSE.BAD_HELLO);
  }
});

test('garbage is ignored and the hello timeout still applies to silent sockets', async (t) => {
  const { server, url } = await startServer(t);
  const p = phone(url, null);
  await new Promise((resolve) => p.ws.on('open', resolve));
  p.ws.send('not json');
  p.ws.send(JSON.stringify({ type: 'ack', alertId: 'x' }));
  p.ws.send(Buffer.from([1, 2, 3]));
  assert.equal(server.listDevices().length, 0);
  p.ws.close();
});

test('reconnecting with the same deviceId replaces the old connection', async (t) => {
  const { server, url } = await startServer(t);
  const first = hello('Noa');
  const a = phone(url, first);
  await a.next('welcome');
  const b = phone(url, { ...first, name: 'Noa (new phone)' });
  await b.next('welcome');
  assert.equal(await a.closed, CLOSE.REPLACED);
  assert.equal(server.listDevices().length, 1);
  assert.equal(server.listDevices()[0].name, 'Noa (new phone)');
  b.ws.close();
});

test('browsers (requests with an Origin header) cannot connect', async (t) => {
  const { url } = await startServer(t);
  const p = phone(url, hello('web'), { origin: 'https://evil.example' });
  const code = await p.closed;
  assert.notEqual(code, 1000);
  assert.equal(p.ws.readyState, WebSocket.CLOSED);
});

test('health endpoint answers GET only', async (t) => {
  const { http } = await startServer(t);
  const res = await fetch(`${http}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await res.json(), { ok: true, app: 'pitboard', teamNumber: '18833' });
  assert.equal((await fetch(`${http}/health`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${http}/`)).status, 404);
});

test('a port that is already taken is reported, not thrown', async (t) => {
  const { server } = await startServer(t);
  const second = new AlertServer();
  await second.start(server.status.port);
  t.after(() => second.stop());
  assert.equal(second.status.running, false);
  assert.match(second.status.error, /תפוס/);
});
