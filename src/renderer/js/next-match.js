import { $, el } from './dom.js';
import { COLOR_NAME, matchTime } from './format.js';

function emptyMessage(dashboard) {
  if (!dashboard || dashboard.status === 'loading') return 'טוען נתונים…';
  if (dashboard.status === 'unconfigured') return 'מזינים את מספר הקבוצה בהגדרות';
  if (!dashboard.data) return dashboard.error ? 'אין נתונים' : '';
  if (!dashboard.data.event) return `עוד לא פורסמו אירועים לקבוצה בעונה ${dashboard.data.season}`;
  if (!dashboard.data.nextMatch) {
    return dashboard.data.matches.length ? 'אין משחקים נוספים באירוע' : 'לוח המשחקים עוד לא פורסם';
  }
  return null;
}

export function renderNextMatch({ dashboard }) {
  const partner = $('partner');
  const colorPanel = $('color-panel');
  const color = $('color');
  partner.replaceChildren();
  colorPanel.classList.remove('red', 'blue');
  color.replaceChildren('—');
  $('next-label').textContent = '';

  const message = emptyMessage(dashboard);
  if (message !== null) {
    partner.append(el('div', { class: 'empty' }, message));
    return;
  }

  const match = dashboard.data.nextMatch;
  $('next-label').textContent = match.label;
  colorPanel.classList.add(match.alliance);
  color.replaceChildren(COLOR_NAME[match.alliance], el('small', {}, match.station));

  if (!match.partners.length) {
    partner.append(el('div', { class: 'empty' }, 'אין שותף ברית במשחק הזה'));
    return;
  }
  for (const team of match.partners) {
    partner.append(
      el('div', { class: 'partner-team' },
        el('div', { class: 'p-number' }, team.display),
        el('div', { class: 'p-name' }, team.name || '—'),
        match.startTime && el('div', { class: 'p-time' }, `משחק ${match.label} · ${matchTime(match.startTime)}`),
      ),
    );
  }
}
