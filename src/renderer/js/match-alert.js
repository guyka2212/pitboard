import { $, el } from './dom.js';
import { COLOR_NAME } from './format.js';

const RING_FOR_MS = 30000;
const BEEP_EVERY_MS = 1600;

let audio = null;
let beepTimer = null;
let stopTimer = null;

function beep() {
  audio = audio || new AudioContext();
  const now = audio.currentTime;
  // three rising tones, loud enough to hear over a noisy pit
  [660, 880, 1100].forEach((frequency, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.16);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.17);
  });
}

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
    el('div', { class: 'ma-match' }, `${match.label} · ${COLOR_NAME[match.alliance]} · ${match.station}`),
    partners && el('div', { class: 'ma-line' }, `עם ${partners}`),
    vs && el('div', { class: 'ma-line' }, `נגד ${vs}`),
  );

  if (!dialog.open) dialog.showModal();
  stopRinging();
  beep();
  beepTimer = setInterval(beep, BEEP_EVERY_MS);
  stopTimer = setTimeout(stopRinging, RING_FOR_MS);
}

export function initMatchAlert() {
  const dialog = $('match-alert');
  $('ma-dismiss').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stopRinging);
}
