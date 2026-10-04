import { $, el } from './dom.js';
import { COLOR_NAME, fieldName } from './format.js';
import { alarm } from './sound.js';

const RING_FOR_MS = 30000;
const BEEP_EVERY_MS = 1600;

let beepTimer = null;
let stopTimer = null;

function stopRinging() {
  clearInterval(beepTimer);
  clearTimeout(stopTimer);
  beepTimer = null;
}

export function showMatchAlert({ match, title }) {
  const dialog = $('match-alert');
  dialog.classList.remove('red', 'blue');
  dialog.classList.add(match.alliance);

  const vs = match.opponents.map((t) => t.display).join(' · ');
  const partners = match.partners.map((t) => `${t.display}${t.name ? ` ${t.name}` : ''}`).join(' · ');
  $('ma-content').replaceChildren(
    el('div', { class: 'ma-title' }, title),
    el('div', { class: 'ma-match' }, [match.label, COLOR_NAME[match.alliance], match.station, fieldName(match.field)].filter(Boolean).join(' · ')),
    partners && el('div', { class: 'ma-line' }, `With ${partners}`),
    vs && el('div', { class: 'ma-line' }, `Against ${vs}`),
  );

  if (!dialog.open) dialog.showModal();
  stopRinging();
  alarm();
  beepTimer = setInterval(alarm, BEEP_EVERY_MS);
  stopTimer = setTimeout(stopRinging, RING_FOR_MS);
}

export function initMatchAlert() {
  const dialog = $('match-alert');
  $('ma-dismiss').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stopRinging);
}
