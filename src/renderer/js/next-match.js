import { $, el, teamLink } from './dom.js';
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

function countdownText(match, onField) {
  if (!Number.isInteger(match.matchesBefore)) return '';
  const field = onField ? ` · על המגרש: ${onField}` : '';
  if (match.matchesBefore === 0) return `הבא בתור${field}`;
  if (match.matchesBefore === 1) return `עוד משחק אחד${field}`;
  return `עוד ${match.matchesBefore} משחקים${field}`;
}

export function renderNextMatch({ dashboard }) {
  const partner = $('partner');
  const colorPanel = $('color-panel');
  const color = $('color');
  const countdown = $('next-countdown');
  partner.replaceChildren();
  colorPanel.classList.remove('red', 'blue');
  color.replaceChildren('—');
  $('next-label').textContent = '';
  countdown.textContent = '';
  countdown.classList.remove('soon');

  const message = emptyMessage(dashboard);
  if (message !== null) {
    partner.append(el('div', { class: 'empty' }, message));
    return;
  }

  const match = dashboard.data.nextMatch;
  $('next-label').textContent = match.label;
  countdown.textContent = countdownText(match, dashboard.data.onField);
  countdown.classList.toggle('soon', match.matchesBefore <= 2);
  colorPanel.classList.add(match.alliance);
  color.replaceChildren(COLOR_NAME[match.alliance], el('small', {}, match.station));

  const partners = match.partners.length
    ? match.partners.map((team) =>
        el('div', { class: 'partner-team' },
          el('div', { class: 'p-number' }, teamLink(team)),
          el('div', { class: 'p-name' }, team.name || '—'),
        ))
    : [el('div', { class: 'empty' }, 'אין שותף ברית במשחק הזה')];

  partner.append(
    el('div', { class: 'partner-teams' }, partners),
    match.opponents.length > 0 &&
      el('div', { class: `versus ${match.alliance === 'red' ? 'blue' : 'red'}` },
        el('span', { class: 'versus-label' }, 'נגד'),
        match.opponents.map((team) => el('span', { class: 'versus-team' }, teamLink(team), el('small', {}, team.name))),
      ),
    match.startTime && el('div', { class: 'p-time' }, `משחק ${match.label} · ${matchTime(match.startTime)}`),
  );
}
