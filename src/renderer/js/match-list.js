import { $, el, teamLink } from './dom.js';
import { COLOR_NAME, OUTCOME_NAME, fieldName, matchTime } from './format.js';

let scrolledToKey = null;

function resultCell(match, isNext) {
  if (isNext) return el('div', { class: 'm-result next' }, 'Next');
  if (match.score && match.outcome) {
    return el('div', { class: `m-result ${match.outcome}` },
      OUTCOME_NAME[match.outcome],
      // our score first
      el('span', { class: 'm-score' }, `${match.score.ours} : ${match.score.theirs}`),
    );
  }
  return el('div', { class: 'm-result' }, match.started ? 'Playing' : COLOR_NAME[match.alliance]);
}

function teamsLine(label, teams, className) {
  return el('div', { class: `m-teams ${className}` },
    el('span', { class: 'm-teams-label' }, label),
    teams.length
      ? teams.map((t) => el('span', { class: 'm-team', title: t.name }, teamLink(t), t.name && el('small', {}, t.name)))
      : el('span', { class: 'm-team' }, '—'),
  );
}

export function renderMatchList({ dashboard }) {
  const list = $('matches');
  list.replaceChildren();
  const data = dashboard && dashboard.data;
  if (!data || !data.matches.length) {
    if (data && data.event) {
      const note = data.schedulePending
        ? "Today's match schedule isn't on FTC yet. It appears here as soon as the event syncs it."
        : 'The match schedule is not published yet';
      list.append(el('li', { class: 'empty-note' }, note));
    }
    return;
  }

  const nextKey = data.nextMatch && data.nextMatch.key;
  let nextRow = null;
  for (const match of data.matches) {
    const isNext = match.key === nextKey;
    const row = el('li', { class: ['match', match.alliance, match.started && 'started', isNext && 'next'].filter(Boolean).join(' ') },
      el('span', { class: 'bar', title: COLOR_NAME[match.alliance] }),
      el('div', { class: 'm-label', title: match.description }, match.label, el('span', { class: 'm-time' }, matchTime(match.startTime)),
        match.field && el('span', { class: 'm-field' }, fieldName(match.field))),
      el('div', { class: 'm-sides' },
        teamsLine('With', match.partners, 'with'),
        teamsLine('vs', match.opponents, 'against'),
      ),
      resultCell(match, isNext),
    );
    if (isNext) nextRow = row;
    list.append(row);
  }

  // Only jump when the next match changes, so a refresh doesn't undo the user's scrolling.
  if (nextRow && nextKey !== scrolledToKey) {
    nextRow.scrollIntoView({ block: 'center' });
    scrolledToKey = nextKey;
  }
}
