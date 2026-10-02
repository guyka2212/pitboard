import { $ } from './dom.js';
import { clock, shortDate } from './format.js';

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
  if (loading) status.textContent = 'טוען…';
  else if (dashboard.error) status.textContent = dashboard.error;
  else if (dashboard.updatedAt) status.textContent = `${settings.demoMode ? 'הדגמה · ' : ''}עודכן ${clock(dashboard.updatedAt)}`;
  else status.textContent = '';
  $('btn-refresh').classList.toggle('spinning', loading);
}

export function renderBanner({ dashboard }) {
  const banner = $('banner');
  // Without any data the error is already shown in the panels themselves.
  const show = Boolean(dashboard && dashboard.error && dashboard.data);
  banner.hidden = !show;
  if (show) banner.textContent = `לא ניתן לעדכן: ${dashboard.error}. מוצגים הנתונים האחרונים.`;
}
