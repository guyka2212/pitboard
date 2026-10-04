// Deciding between FTC Events and FTCScout when both have an event's schedule.
const { matchKey } = require('./schedule');

const isUsable = (source) => Boolean(source && !source.error && source.matches.length > 0);

const progress = (matches) => matches.filter((m) => m.actualStartTime || m.postResultTime).length;

const lineup = (m) => (m.teams || []).map((t) => `${t.station}:${t.teamNumber}`).sort().join(',');

/** Matches the two sources disagree on: missing from one, or different teams. */
function conflicts(a, b) {
  const left = new Map(a.map((m) => [matchKey(m), lineup(m)]));
  const right = new Map(b.map((m) => [matchKey(m), lineup(m)]));
  let count = 0;
  for (const [key, teams] of left) if (right.get(key) !== teams) count += 1;
  for (const key of right.keys()) if (!left.has(key)) count += 1;
  return count;
}

/**
 * Returns 'ftc' or 'ftcscout'.
 * - Only one has matches: that one.
 * - Same schedule: whichever has more matches played (FTCScout copies from FTC, so it can lag;
 *   it can also be ahead when FTC's own cache is behind). A tie goes to FTC, the official source.
 * - Different schedules: the one updated most recently, since a schedule only changes when the
 *   event regenerates it.
 */
function chooseSource(ftc, scout) {
  if (isUsable(ftc) !== isUsable(scout)) return isUsable(scout) ? 'ftcscout' : 'ftc';
  if (!isUsable(ftc)) return ftc && !ftc.error ? 'ftc' : scout && !scout.error ? 'ftcscout' : 'ftc';

  if (conflicts(ftc.matches, scout.matches) === 0) {
    return progress(scout.matches) > progress(ftc.matches) ? 'ftcscout' : 'ftc';
  }
  return (scout.updatedAt || 0) > (ftc.updatedAt || 0) ? 'ftcscout' : 'ftc';
}

module.exports = { chooseSource, conflicts };
