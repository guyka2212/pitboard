import { $ } from './dom.js';
import { clock, dayAndTime, shortDate } from './format.js';

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
      data && data.ftcUpdatedAt && `FTC data ${dayAndTime(data.ftcUpdatedAt)}`,
    ].filter(Boolean).join(' · ');
  } else status.textContent = '';
  $('btn-refresh').classList.toggle('spinning', loading);
}

export function renderBanner({ dashboard }) {
  const banner = $('banner');
  const data = dashboard && dashboard.data;
  let text = '';
  let warning = false;
  // Without any data the error is already shown in the panels themselves.
  if (dashboard && dashboard.error && data) {
    text = `Can't update: ${dashboard.error}. Showing the last data.`;
  } else if (data && data.ftcNotSyncedToday) {
    warning = true;
    text = `FTC hasn't published anything new for this event today (last change ${dayAndTime(data.ftcUpdatedAt)}). `
      + "Today's matches show up here once the event's scorekeeper syncs them to FTC.";
  }
  banner.hidden = !text;
  banner.classList.toggle('warning', warning);
  banner.textContent = text;
}
