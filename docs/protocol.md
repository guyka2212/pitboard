# Phone protocol

PitBoard runs a small server on the pit laptop. Phones connect to it over a WebSocket,
and the "התראה" (alert) button next to each name sends that phone a message.

## Connecting

- **Port:** 8765 by default (Settings → כפתור חירום).
- **Same Wi‑Fi:** `ws://<laptop IP>:8765/`. The addresses are listed in the settings window.
- **From anywhere:** forward the port in VS Code (Ports tab → Forward a Port → `8765` → right‑click →
  Port Visibility → Public). That gives a URL like `https://abcd1234-8765.euw.devtunnels.ms`;
  the WebSocket URL is the same with `wss://` (`http` → `ws`).
- `GET /health` returns `{"ok":true,"app":"pitboard","teamNumber":"18833"}`. Any other path
  or method gets 404/405.
- Requests that carry an `Origin` header are refused. Browsers always send one; native clients
  (OkHttp, URLSession) don't unless you add it.

All messages are JSON text frames. Unknown types and fields must be ignored by both sides.

## Phone → server

### `hello`

Must be the first message, within 10 seconds of connecting.

```json
{ "type": "hello", "name": "Noa", "deviceId": "6f1c2b9e-1f7a-4a53-9a59-2d1f3b8a7c10", "joinCode": "HNUYQC" }
```

| field      | rules |
|------------|-------|
| `name`     | 1–40 characters after trimming. Shown next to the alert button. |
| `deviceId` | 8–64 characters, letters, digits and `-` (a UUID works). Generate once and keep it, so a reconnect replaces the old entry instead of adding a second one. |
| `joinCode` | The code shown in the laptop's settings. Case-insensitive. Send `""` if the laptop has none. |

### `ack`

Sent when the person dismisses the alert. The laptop shows "אישר" and the time next to the name.

```json
{ "type": "ack", "alertId": "…" }
```

## Server → phone

```json
{ "type": "welcome", "deviceId": "…", "teamNumber": "18833" }
{ "type": "alert", "alertId": "uuid", "message": "בואו לפיט עכשיו!", "sentAt": 1791000000000 }
{ "type": "error", "code": "bad_join_code", "message": "קוד הצטרפות שגוי" }
```

`error` codes: `bad_join_code`, `missing_name`, `bad_device_id`, `server_full`. The socket is
closed right after an error.

## Close codes

| code  | meaning                                        | phone should            |
|-------|------------------------------------------------|-------------------------|
| 4000  | no `hello` within 10 s                         | reconnect               |
| 4001  | wrong join code                                | stop, ask for the code  |
| 4002  | invalid name or device id                      | stop, ask for a name    |
| 4003  | the same `deviceId` connected from elsewhere   | stop                    |
| 4004  | removed from the list on the laptop            | stop                    |
| 4005  | the list is full (50 phones)                   | stop                    |
| other | network drop, laptop app closed                | reconnect with backoff  |

## Keep‑alive

The server pings every 20 seconds and drops a connection that misses two pings. WebSocket
libraries answer pings on their own.
