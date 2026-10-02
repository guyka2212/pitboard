import { $ } from './dom.js';

// Long enough that the logo doesn't just blink, short enough not to slow anyone down.
const MIN_VISIBLE_MS = 1200;
// If FTC is slow to answer, the panels show their own loading state instead.
const MAX_VISIBLE_MS = 8000;
const FADE_MS = 350;

const shownAt = performance.now();
let gone = null;

export function setSplashStatus(text) {
  const status = $('splash-status');
  if (status) status.textContent = text;
}

/** Fades the loading screen out; resolves once it is off the screen. */
export function hideSplash() {
  if (gone) return gone;
  const remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt));
  gone = new Promise((resolve) => {
    setTimeout(() => {
      const splash = $('splash');
      splash.classList.add('leaving');
      setTimeout(() => {
        splash.remove();
        resolve();
      }, FADE_MS);
    }, remaining);
  });
  return gone;
}

setTimeout(hideSplash, MAX_VISIBLE_MS);
