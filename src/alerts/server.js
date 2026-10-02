// WebSocket server the team's phones connect to. Protocol: docs/protocol.md
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { WebSocketServer } = require('ws');

const HEARTBEAT_MS = 20000;
const HELLO_TIMEOUT_MS = 10000;
const MAX_DEVICES = 50;

const CLOSE = {
  HELLO_TIMEOUT: 4000,
  BAD_JOIN_CODE: 4001,
  BAD_HELLO: 4002,
  REPLACED: 4003,
  REMOVED: 4004,
  SERVER_FULL: 4005,
};

function sameCode(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function send(ws, message) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function parse(raw) {
  try {
    const msg = JSON.parse(raw.toString());
    return msg && typeof msg === 'object' && typeof msg.type === 'string' ? msg : null;
  } catch {
    return null;
  }
}

class AlertServer extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.httpServer = null;
    this.wss = null;
    this.heartbeat = null;
    this.status = { running: false, port: null, error: null };
    this.joinCode = '';
    this.teamNumber = '';
  }

  configure({ joinCode, teamNumber }) {
    this.joinCode = joinCode || '';
    this.teamNumber = teamNumber || '';
  }

  async start(port) {
    await this.stop();
    this.httpServer = http.createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: 4 * 1024,
      // The phone app is a native client. Browsers always send Origin, so a web page
      // someone opens on the team laptop can't connect and pose as a phone.
      verifyClient: ({ req }) => !req.headers.origin,
    });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    // ws re-emits the HTTP server's errors; the listen handler below already reports them.
    this.wss.on('error', () => {});
    this.heartbeat = setInterval(() => this.checkAlive(), HEARTBEAT_MS);

    await new Promise((resolve) => {
      this.httpServer.once('error', (err) => {
        const error = err.code === 'EADDRINUSE' ? `פורט ${port} כבר תפוס על ידי תוכנה אחרת` : err.message;
        this.setStatus({ running: false, port, error });
        resolve();
      });
      this.httpServer.listen(port, '0.0.0.0', () => {
        this.setStatus({ running: true, port: this.httpServer.address().port, error: null });
        resolve();
      });
    });
  }

  async stop() {
    clearInterval(this.heartbeat);
    if (this.wss) {
      for (const ws of this.wss.clients) ws.terminate();
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      const server = this.httpServer;
      this.httpServer = null;
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    }
    for (const device of this.devices.values()) {
      device.online = false;
      device.ws = null;
    }
    this.setStatus({ running: false, port: null, error: null });
    this.emitDevices();
  }

  checkAlive() {
    for (const ws of this.wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }

  handleHttp(req, res) {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (req.method !== 'GET') {
      res.writeHead(405, { ...headers, Allow: 'GET' });
      res.end();
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, app: 'pitboard', teamNumber: this.teamNumber }));
      return;
    }
    res.writeHead(404, headers);
    res.end();
  }

  handleConnection(ws) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('error', () => {});

    let deviceId = null;
    const helloTimer = setTimeout(() => ws.close(CLOSE.HELLO_TIMEOUT, 'hello timeout'), HELLO_TIMEOUT_MS);

    ws.on('message', (raw, isBinary) => {
      const msg = isBinary ? null : parse(raw);
      if (!msg) return;
      if (!deviceId) {
        if (msg.type !== 'hello') return;
        clearTimeout(helloTimer);
        deviceId = this.handleHello(ws, msg);
      } else if (msg.type === 'ack') {
        this.handleAck(deviceId, msg);
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      const device = deviceId && this.devices.get(deviceId);
      if (device && device.ws === ws) {
        device.online = false;
        device.ws = null;
        this.emitDevices();
      }
    });
  }

  /** Returns the device id on success, or null after rejecting the connection. */
  handleHello(ws, msg) {
    const reject = (code, error, message) => {
      send(ws, { type: 'error', code: error, message });
      ws.close(code, error);
      return null;
    };

    if (this.joinCode && !sameCode(String(msg.joinCode || '').trim().toUpperCase(), this.joinCode)) {
      return reject(CLOSE.BAD_JOIN_CODE, 'bad_join_code', 'קוד הצטרפות שגוי');
    }
    const name = typeof msg.name === 'string' ? msg.name.replace(/\s+/g, ' ').trim() : '';
    if (!name || name.length > 40) {
      return reject(CLOSE.BAD_HELLO, 'missing_name', 'חסר שם (עד 40 תווים)');
    }
    const id = typeof msg.deviceId === 'string' ? msg.deviceId.trim() : '';
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      return reject(CLOSE.BAD_HELLO, 'bad_device_id', 'מזהה מכשיר לא תקין');
    }

    const existing = this.devices.get(id);
    if (!existing && this.devices.size >= MAX_DEVICES) {
      return reject(CLOSE.SERVER_FULL, 'server_full', 'הרשימה מלאה');
    }
    if (existing && existing.ws && existing.ws !== ws) existing.ws.close(CLOSE.REPLACED, 'replaced');

    this.devices.set(id, { id, name, ws, online: true, lastAlert: existing ? existing.lastAlert : null });
    send(ws, { type: 'welcome', deviceId: id, teamNumber: this.teamNumber });
    this.emitDevices();
    return id;
  }

  handleAck(deviceId, msg) {
    const device = this.devices.get(deviceId);
    if (device && device.lastAlert && !device.lastAlert.ackAt && device.lastAlert.alertId === msg.alertId) {
      device.lastAlert.ackAt = Date.now();
      this.emitDevices();
    }
  }

  alert(deviceId, message) {
    const device = this.devices.get(deviceId);
    if (!device || !device.online) return false;
    const alertId = crypto.randomUUID();
    const sentAt = Date.now();
    send(device.ws, { type: 'alert', alertId, message, sentAt });
    device.lastAlert = { alertId, sentAt, ackAt: null };
    this.emitDevices();
    return true;
  }

  alertAll(message) {
    let sent = 0;
    for (const id of this.devices.keys()) if (this.alert(id, message)) sent += 1;
    return sent;
  }

  removeDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    this.devices.delete(deviceId);
    if (device.ws) device.ws.close(CLOSE.REMOVED, 'removed');
    this.emitDevices();
    return true;
  }

  listDevices() {
    return [...this.devices.values()]
      .map(({ id, name, online, lastAlert }) => ({ id, name, online, lastAlert: lastAlert && { ...lastAlert } }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'he'));
  }

  setStatus(status) {
    this.status = status;
    this.emit('status', status);
  }

  emitDevices() {
    this.emit('devices', this.listDevices());
  }
}

module.exports = { AlertServer, CLOSE };
