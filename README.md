# PitBoard

A pit display for FTC teams. It shows your next match from the
[FTC Events API](https://ftc-events.firstinspires.org/api-docs/index.html). It also has an alert button
that rings a team member's phone and calls them back to the pit.

| Area                   | Shows |
|------------------------|-------|
| **צבע**                | Alliance color and station for the next match |
| **ברית משחק הבא**      | Alliance partner for the next match: number, name, time |
| **כל המשחקים**         | All of your matches at the event: partner, color, result. The next one is highlighted |
| **צ'ק ליסט**           | Pre-match checklist. It clears itself whenever the next match changes |
| **חירום**              | Phones connected through the phone app, each with an alert button |

## Running

```bash
npm install
npm start
```

```bash
npm test
```

```bash
npm run dist
```

`npm run dist` runs the tests and then builds `dist/PitBoard Setup <version>.exe` and a portable
`.exe`. F11 toggles full screen.

## Setup

On first launch the settings window opens and asks for the team number. It's saved in
`%APPDATA%/PitBoard/settings.json`, so it only has to be entered once. Leave season and event code
empty: the app uses the season FTC calls current and finds the team's current or next event.

## FTC API account

The app reads its FTC Events API account from `ftc-credentials.json` next to `package.json`. The
file is packed into the build and is not editable from the app:

```json
{ "apiUsername": "…", "apiKey": "…" }
```

The file is git-ignored. FTC bans tokens that get published, so don't commit it, and share builds
that contain it only with people you trust. Without the file, the app shows an error instead of
match data (demo mode still works).

## Phones

The app listens on port 8765 (configurable). The settings window shows:
- whether the port is open
- the addresses to copy
- the join code, which is generated on first run

To reach the laptop from outside the local network, forward the port in VS Code (Ports tab) and set
its visibility to Public. The protocol is in [docs/protocol.md](docs/protocol.md).

## Icon and logo

`build/icon.svg` is the source of the app icon. After changing it, run `npm run icon` to regenerate
`build/icon.ico`. The loading screen uses `src/renderer/assets/logo-mark.svg` and the Rubik font
(SIL Open Font License, see `src/renderer/assets/fonts/OFL.txt`).

## Layout

```
src/main/        Electron main process: window, IPC, refresh loop, checklist rules
src/ftc/         FTC Events API client and schedule parsing
src/alerts/      WebSocket server for the phones
src/settings/    Settings validation and storage
src/renderer/    The window (Hebrew, RTL), split into one module per panel
test/            node:test suites, run with `npm test`
scripts/         build-icon.js (SVG → .ico)
docs/            Phone protocol and the FTC API spec it was built against
```
