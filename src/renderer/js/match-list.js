import { $, el } from './dom.js';
import { COLOR_NAME, OUTCOME_NAME, matchTime } from './format.js';

let scrolledToKey = null;

function resultCell(match, isNext) {
  if (isNext) return el('div', { class: 'm-result next' }, 'הבא');
  if (match.score && match.outcome) {
    return el('div', { class: `m-result ${match.outcome}` },
      OUTCOME_NAME[match.outcome],
      // our score first; always LTR so it doesn't flip inside the RTL layout
      el('bdi', { dir: 'ltr', class: 'm-score' }, `${match.score.ours} : ${match.score.theirs}`),
    );
  }
  return el('div', { class: 'm-result' }, match.started ? 'משוחק' : COLOR_NAME[match.alliance]);
}

export function renderMatchList({ dashboard }) {
  const list = $('matches');
  list.replaceChildren();
  const data = dashboard && dashboard.data;
  if (!data || !data.matches.length) {
    if (data && data.event) list.append(el('li', { class: 'empty-note' }, 'לוח המשחקים עוד לא פורסם'));
    return;
  }

  const nextKey = data.nextMatch && data.nextMatch.key;
  let nextRow = null;
  for (const match of data.matches) {
    const isNext = match.key === nextKey;
    const partners = match.partners.length ? match.partners : [{ display: '—', name: '' }];
    const row = el('li', { class: ['match', match.alliance, match.started && 'started', isNext && 'next'].filter(Boolean).join(' ') },
      el('span', { class: 'bar', title: COLOR_NAME[match.alliance] }),
      el('div', { class: 'm-label', title: match.description }, match.label, el('span', { class: 'm-time' }, matchTime(match.startTime))),
      el('div', { class: 'm-partner' }, partners.map((p) => [el('b', {}, p.display), el('span', {}, p.name)])),
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
