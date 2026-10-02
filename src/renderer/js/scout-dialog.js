import { $, el, icon, teamLink } from './dom.js';
import { stat } from './format.js';

const COLUMNS = [
  { key: 'rank', label: 'Rank', dir: 'asc' },
  { key: 'number', label: 'Team', dir: 'asc' },
  { key: 'npOpr', label: 'np OPR', dir: 'desc' },
  { key: 'autoOpr', label: 'Auto OPR', dir: 'desc' },
  { key: 'dcOpr', label: 'Teleop OPR', dir: 'desc' },
  { key: 'npAvg', label: 'np AVG', dir: 'desc' },
  { key: 'record', label: 'Record', sortable: false },
];

const view = { result: null, mode: 'event', sortKey: 'rank', sortDir: 'asc', loading: false };

const statsFor = (row) => (view.mode === 'event' ? row.event : row.season);

function sortValue(row, key) {
  if (key === 'number') return row.number;
  const line = statsFor(row);
  return line ? line[key] : null;
}

function sortedRows(rows) {
  const factor = view.sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, view.sortKey);
    const y = sortValue(b, view.sortKey);
    // teams without numbers always go last, whichever way the column is sorted
    if (x === null || x === undefined) return y === null || y === undefined ? a.number - b.number : 1;
    if (y === null || y === undefined) return -1;
    return (x - y) * factor || a.number - b.number;
  });
}

function rankCell(line) {
  if (!line || line.rank === null) return '—';
  if (view.mode === 'event') return `#${line.rank}`;
  return el('span', { title: `#${line.rank} of ${line.rankedOf} worldwide by np OPR` }, `#${line.rank}`);
}

function recordCell(line) {
  if (!line) return '—';
  if (view.mode === 'event') {
    return line.wins === null ? `${line.played ?? 0} played` : `${line.wins}-${line.losses}-${line.ties}`;
  }
  return line.matches ? `${line.matches} played` : '—';
}

function renderHead() {
  const row = el('tr', {});
  for (const col of COLUMNS) {
    if (col.sortable === false) {
      row.append(el('th', { scope: 'col' }, col.label));
      continue;
    }
    const active = view.sortKey === col.key;
    const button = el('button', { type: 'button', class: `sort-btn${active ? ' active' : ''}` }, col.label, active && icon('sort', 14));
    button.addEventListener('click', () => {
      view.sortDir = active ? (view.sortDir === 'asc' ? 'desc' : 'asc') : col.dir;
      view.sortKey = col.key;
      renderTable();
    });
    row.append(el('th', { scope: 'col', 'aria-sort': active ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none' }, button));
  }
  $('scout-head').replaceChildren(row);
}

function renderTable() {
  renderHead();
  const body = $('scout-body');
  body.replaceChildren();
  const { table, ourTeam } = view.result;

  for (const row of sortedRows(table.rows)) {
    const line = statsFor(row);
    const tr = el('tr', { class: row.number === ourTeam ? 'ours' : '' },
      el('td', { class: 'rank' }, rankCell(line)),
      el('td', { class: 'team' }, teamLink(row), el('span', { class: 'team-name' }, row.name)),
      el('td', {}, stat(line && line.npOpr)),
      el('td', {}, stat(line && line.autoOpr)),
      el('td', {}, stat(line && line.dcOpr)),
      el('td', {}, stat(line && line.npAvg)),
      el('td', { class: 'record' }, recordCell(line)),
    );
    body.append(tr);
  }
}

function renderModeButtons() {
  const { table } = view.result;
  for (const button of document.querySelectorAll('#scout-modes button')) {
    const mode = button.dataset.mode;
    button.classList.toggle('active', mode === view.mode);
    button.disabled = mode === 'event' && !table.hasEventStats;
    if (mode === 'season') button.textContent = `Season ${table.statsSeason}`;
  }
  const notes = [];
  if (!table.hasEventStats) notes.push('No data from this event yet, so season stats are shown.');
  if (table.statsSeason !== table.season) {
    notes.push(`FTCScout has no ${table.season} data yet, so these numbers are from ${table.statsSeason}.`);
  }
  if (view.mode === 'season') notes.push('Season rank = world rank by np OPR.');
  $('scout-note').textContent = notes.join(' ');
}

function setMode(mode) {
  view.mode = mode;
  view.sortKey = mode === 'event' ? 'rank' : 'npOpr';
  view.sortDir = mode === 'event' ? 'asc' : 'desc';
  renderModeButtons();
  renderTable();
}

function showMessage(text) {
  $('scout-head').replaceChildren();
  $('scout-body').replaceChildren(el('tr', {}, el('td', { class: 'scout-message', colspan: COLUMNS.length }, text)));
}

export async function openScout(state) {
  const dialog = $('scout');
  if (!dialog.open) dialog.showModal();
  if (view.loading) return;
  view.loading = true;
  $('scout-sub').textContent = '';
  $('scout-note').textContent = '';
  showMessage('Loading data from FTCScout…');

  try {
    const result = await window.hub.scoutEvent();
    if (!result.ok) {
      showMessage(result.error);
      return;
    }
    view.result = { table: result.table, ourTeam: Number(state.settings.teamNumber) };
    $('scout-sub').textContent = `${result.event.name} · ${result.table.rows.length} teams`;
    setMode(result.table.hasEventStats ? 'event' : 'season');
  } catch (err) {
    showMessage(`Loading failed: ${err.message}`);
  } finally {
    view.loading = false;
  }
}

export function initScoutDialog() {
  $('scout-close').append(icon('close'));
  $('scout-close').addEventListener('click', () => $('scout').close());
  for (const button of document.querySelectorAll('#scout-modes button')) {
    button.addEventListener('click', () => {
      if (view.result && !button.disabled) setMode(button.dataset.mode);
    });
  }
}
