# PitBoard

A pit display for FTC teams. It shows your next match from the
[FTC Events API](https://ftc-events.firstinspires.org/api-docs/index.html). It also has an alert button
that rings a team member's phone and calls them back to the pit.

| Area                   | Shows |
|------------------------|-------|
| **צבע**                | Alliance color and station for the next match |
| **ברית משחק הבא**      | Alliance partner and opponents for the next match, and how many matches are left before it |
| **כל המשחקים**         | All of your matches at the event: partner, opponents, color, result. The next one is highlighted |
| **צ'ק ליסט**           | Pre-match checklist. It clears itself whenever the next match changes |
| **חירום**              | Phones connected through the phone app, each with an alert button |

When only two matches are left before yours, the app shows a full-screen alert with sound. It also
flashes the taskbar button and sends a Windows notification, once per match.

## Chat

The chat button next to the scout button (and the small chat button next to each phone in the
emergency panel) opens a conversation with one of the connected phones. Pick the person on the
side and write.
- **Delivery:** messages to a phone that's offline wait and go out when it reconnects.
- **Status:** each sent message shows whether it was delivered and read.
- **Replies:** phones can answer. Unread replies show as a badge and play a short sound, plus a
  Windows notification when PitBoard isn't in front.
- **History:** kept until PitBoard is closed.

## Scouting

Team stats come from [FTCScout](https://ftcscout.org/api) (GraphQL, no key needed):

- **Any team number** in the window can be clicked. It shows that team's np OPR, Auto OPR,
  Teleop OPR, np AVG and ranking, both at the current event and for the season. It also shows
  their match history for the season, grouped by event.
- **The scout button** (chart icon, next to refresh) opens a table of every team at the event.
  - Sort it by ranking, np OPR, Auto OPR, Teleop OPR or np AVG.
  - Switch between stats from this event and season stats.
  - In season mode, the ranking is the team's world rank by np OPR.

FTCScout adds each new game a while after the season starts. Until then the app shows the latest
season FTCScout has and says so. The team list always comes from the FTC API, so the table works
even for events FTCScout hasn't picked up yet.

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
src/scout/       FTCScout client, season detection and stats shaping
src/alerts/      WebSocket server for the phones
src/settings/    Settings validation and storage
src/renderer/    The window (Hebrew, RTL), split into one module per panel
test/            node:test suites, run with `npm test`
scripts/         build-icon.js (SVG → .ico)
docs/            Phone protocol and the FTC API spec it was built against
```
