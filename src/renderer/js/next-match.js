import { $, el, teamLink } from './dom.js';
import { COLOR_NAME, fieldName, matchTime } from './format.js';

function emptyMessage(dashboard) {
  if (!dashboard || dashboard.status === 'loading') return 'Loading data…';
  if (dashboard.status === 'unconfigured') return 'Enter your team number in Settings';
  if (!dashboard.data) return dashboard.error ? 'No data' : '';
  if (!dashboard.data.event) return `No events published for the team in the ${dashboard.data.season} season yet`;
  if (!dashboard.data.nextMatch) {
    return dashboard.data.matches.length ? 'No more matches at this event' : 'The match schedule is not published yet';
  }
  return null;
}

function countdownText(match, onField) {
  if (!Number.isInteger(match.matchesBefore)) return '';
  let field = '';
  if (onField) field = onField.field ? ` · on Field ${onField.field}: ${onField.label}` : ` · on field: ${onField.label}`;
  if (match.matchesBefore === 0) return `Up next${field}`;
  if (match.matchesBefore === 1) return `1 match away${field}`;
  return `${match.matchesBefore} matches away${field}`;
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
  $('next-label').textContent = [match.label, fieldName(match.field)].filter(Boolean).join(' · ');
  // A countdown on data FTC hasn't updated today would be wrong; the banner explains why.
  const stale = dashboard.data.ftcNotSyncedToday;
  countdown.textContent = stale ? 'Not live: FTC data is from an earlier day' : countdownText(match, dashboard.data.onField);
  countdown.classList.toggle('soon', !stale && match.matchesBefore <= 2);
  colorPanel.classList.add(match.alliance);
  // DOM append() would print "null"/"false" for optional parts, so filter them out first.
  color.replaceChildren(...[
    COLOR_NAME[match.alliance],
    el('small', {}, match.station),
    match.field && el('span', { class: 'field-tag' }, fieldName(match.field)),
  ].filter(Boolean));

  const partners = match.partners.length
    ? match.partners.map((team) =>
        el('div', { class: 'partner-team' },
          el('div', { class: 'p-number' }, teamLink(team)),
          el('div', { class: 'p-name' }, team.name || '—'),
        ))
    : [el('div', { class: 'empty' }, 'No alliance partner in this match')];

  const current = dashboard.data.currentMatch;
  partner.append(...[
    current && el('div', { class: `now-playing ${current.alliance}` },
      el('span', { class: 'live-dot' }),
      ['Playing now', current.label, COLOR_NAME[current.alliance], fieldName(current.field)].filter(Boolean).join(' · ')),
    el('div', { class: 'partner-teams' }, partners),
    match.opponents.length > 0 &&
      el('div', { class: `versus ${match.alliance === 'red' ? 'blue' : 'red'}` },
        el('span', { class: 'versus-label' }, 'vs'),
        match.opponents.map((team) => el('span', { class: 'versus-team' }, teamLink(team), el('small', {}, team.name))),
      ),
    match.startTime && el('div', { class: 'p-time' }, ['Match ' + match.label, matchTime(match.startTime), fieldName(match.field)].filter(Boolean).join(' · ')),
  ].filter(Boolean));
}
