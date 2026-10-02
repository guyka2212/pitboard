import { $, el, icon, teamLink } from './dom.js';
import { COLOR_NAME, OUTCOME_NAME, ltr, shortDate, stat } from './format.js';

let requestId = 0;

function tiles(line, rankText) {
  const tile = (label, value) => el('div', { class: 'tile' }, el('div', { class: 'tile-value' }, ltr(value)), el('div', { class: 'tile-label' }, label));
  return el('div', { class: 'tiles' },
    tile('np OPR', stat(line.npOpr)),
    tile('Auto OPR', stat(line.autoOpr)),
    tile('Teleop OPR', stat(line.dcOpr)),
    tile('np AVG', stat(line.npAvg)),
    tile('דירוג', rankText),
  );
}

function statsSection(title, line, rankText, note) {
  return el('section', { class: 'tc-section' },
    el('h3', {}, title),
    note && el('p', { class: 'hint' }, note),
    line ? tiles(line, rankText) : el('p', { class: 'empty-note' }, 'אין נתונים עדיין'),
  );
}

function historyRow(match) {
  const teams = (list) => (list.length
    ? el('span', { class: 'h-teams' }, list.map((t) => el('span', { title: t.name }, teamLink(t))))
    : '—');
  return el('tr', { class: `h-row ${match.alliance}${match.played ? '' : ' upcoming'}` },
    el('td', { class: 'h-label' }, el('span', { class: 'h-bar', title: COLOR_NAME[match.alliance] }), match.label),
    el('td', {}, teams(match.partners)),
    el('td', {}, teams(match.opponents)),
    el('td', { class: `h-result ${match.outcome || ''}` },
      match.score
        ? [OUTCOME_NAME[match.outcome], ' ', el('bdi', { dir: 'ltr' }, `${match.score.ours} : ${match.score.theirs}`)]
        : match.played ? 'משוחק' : 'טרם שוחק'),
  );
}

function historySection(history) {
  if (!history.length) return el('section', { class: 'tc-section' }, el('h3', {}, 'היסטוריית משחקים'), el('p', { class: 'empty-note' }, 'אין משחקים בעונה הזו'));
  return el('section', { class: 'tc-section' },
    el('h3', {}, 'היסטוריית משחקים'),
    history.map((event) =>
      el('div', { class: 'h-event' },
        el('div', { class: 'h-event-name' }, event.name, el('span', {}, shortDate(event.start))),
        el('table', { class: 'h-table' },
          el('thead', {}, el('tr', {}, el('th', {}, 'משחק'), el('th', {}, 'עם'), el('th', {}, 'נגד'), el('th', {}, 'תוצאה'))),
          el('tbody', {}, event.matches.map(historyRow)),
        ),
      )),
  );
}

function renderCard(card) {
  const seasonNote = card.statsSeason !== card.season
    ? `ל-FTCScout עוד אין נתונים לעונה ${card.season}, אז מוצגת עונה ${card.statsSeason}.`
    : null;
  const season = card.seasonStats;
  const seasonRank = season && season.rank ? `#${season.rank}` : '—';

  $('team-title').replaceChildren(el('span', { class: 'tc-number' }, String(card.number)), el('span', { class: 'tc-name' }, card.name));
  $('team-sub').textContent = card.location;
  $('team-body').replaceChildren(
    card.eventCode && statsSection('באירוע הנוכחי', card.event, card.event && card.event.rank ? `#${card.event.rank}` : '—'),
    statsSection(`עונה ${card.statsSeason}`, season, seasonRank,
      [seasonNote, season && season.rankedOf ? `דירוג = מקום בעולם לפי np OPR, מתוך ${season.rankedOf} קבוצות.` : null].filter(Boolean).join(' ')),
    historySection(card.history),
  );
}

export async function openTeam(number) {
  const dialog = $('team-card');
  const id = ++requestId;
  $('team-title').replaceChildren(el('span', { class: 'tc-number' }, String(number)));
  $('team-sub').textContent = '';
  $('team-body').replaceChildren(el('p', { class: 'empty-note' }, 'טוען נתונים מ-FTCScout…'));
  if (!dialog.open) dialog.showModal();

  try {
    const result = await window.hub.scoutTeam(number);
    if (id !== requestId) return; // another team was clicked meanwhile
    if (!result.ok) {
      $('team-body').replaceChildren(el('p', { class: 'empty-note' }, result.error));
      return;
    }
    renderCard(result.card);
  } catch (err) {
    if (id === requestId) $('team-body').replaceChildren(el('p', { class: 'empty-note' }, `הטעינה נכשלה: ${err.message}`));
  }
}

export function initTeamDialog() {
  $('team-close').append(icon('close'));
  $('team-close').addEventListener('click', () => $('team-card').close());
}
