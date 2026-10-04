import { $ } from './dom.js';
import { clock, dayAndTime, shortDate } from './format.js';

/** e.g. "FTC Events Sat 19:45", plus a note when FTCScout lists different matches. */
function sourceText(data) {
  if (!data.source) return '';
  const when = data.dataUpdatedAt ? ` ${dayAndTime(data.dataUpdatedAt)}` : '';
  return `${data.source.used}${when}${data.source.disagree ? ' (sources differ)' : ''}`;
}

/** Hover text with what each source returned. */
function sourceDetails(data) {
  if (!data.source) return '';
  const line = (name, s) => `${name}: ${s.error ? s.error : `${s.matches} matches${s.updatedAt ? `, updated ${dayAndTime(s.updatedAt)}` : ''}`}`;
  return [`Showing ${data.source.used}`, line('FTC Events', data.source.ftc), line('FTCScout', data.source.ftcscout)].join('\n');
}

export function renderHeader({ settings, dashboard }) {
  const data = dashboard && dashboard.data;
  $('hdr-team').textContent = settings.teamNumber ? `#${settings.teamNumber}` : 'PitBoard';
  $('hdr-team-name').textContent = (data && data.teamName) || '';

  const event = data && data.event;
  $('hdr-event').textContent = event
    ? [event.name, event.city, shortDate(event.dateStart)].filter(Boolean).join(' · ')
    : '';

  const status = $('hdr-status');
  const loading = !dashboard || dashboard.status === 'loading';
  status.classList.toggle('error', Boolean(dashboard && dashboard.error));
  if (loading) status.textContent = 'Loading…';
  else if (dashboard.error) status.textContent = dashboard.error;
  else if (dashboard.updatedAt) {
    // "Checked" is when PitBoard last asked; "FTC data" is when FTC last changed anything for the event.
    status.textContent = [
      settings.demoMode && 'Demo',
      `Checked ${clock(dashboard.updatedAt)}`,
      data && sourceText(data),
    ].filter(Boolean).join(' · ');
    status.title = data ? sourceDetails(data) : '';
  } else status.textContent = '';
  $('btn-refresh').classList.toggle('spinning', loading);
}

export function renderBanner({ dashboard }) {
  const banner = $('banner');
  const data = dashboard && dashboard.data;
  // Without any data the error is already shown in the panels themselves.
  const text = dashboard && dashboard.error && data ? `Can't update: ${dashboard.error}. Showing the last data.` : '';
  banner.hidden = !text;
  banner.textContent = text;
}
