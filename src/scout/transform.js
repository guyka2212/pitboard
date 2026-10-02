// Pure functions that shape FTCScout responses for the scout table and team cards.

const num = (v) => (Number.isFinite(v) ? v : null);

/** One team's stats at one event, or null before it has played. */
function eventLine(stats) {
  if (!stats || !stats.opr) return null;
  return {
    rank: num(stats.rank),
    played: num(stats.qualMatchesPlayed),
    wins: num(stats.wins),
    losses: num(stats.losses),
    ties: num(stats.ties),
    npOpr: num(stats.opr.totalPointsNp),
    autoOpr: num(stats.opr.autoPoints),
    dcOpr: num(stats.opr.dcPoints),
    npAvg: num(stats.avg && stats.avg.totalPointsNp),
  };
}

/**
 * Season numbers: OPRs and world rank come from FTCScout's quick stats; the np average is
 * the average over all of the season's qualification matches, across events.
 */
function seasonLine(quickStats, events = []) {
  let matches = 0;
  let points = 0;
  for (const e of events) {
    const line = eventLine(e && e.stats);
    if (line && line.played && line.npAvg !== null) {
      matches += line.played;
      points += line.npAvg * line.played;
    }
  }
  if (!quickStats && !matches) return null;
  return {
    npOpr: num(quickStats?.tot?.value),
    autoOpr: num(quickStats?.auto?.value),
    dcOpr: num(quickStats?.dc?.value),
    rank: num(quickStats?.tot?.rank),
    rankedOf: num(quickStats?.count),
    npAvg: matches ? points / matches : null,
    matches,
  };
}

function matchLabel(match) {
  if (match.tournamentLevel === 'Quals') return `Q${match.matchNum}`;
  return match.description || `P${match.series}`;
}

/** A team's season, grouped by event (newest first), each match from that team's point of view. */
function matchHistory(participations, teamNumber) {
  const events = new Map();
  for (const p of participations || []) {
    const m = p && p.match;
    if (!m) continue;
    if (!events.has(p.eventCode)) {
      events.set(p.eventCode, { code: p.eventCode, name: p.event?.name || p.eventCode, start: p.event?.start || '', matches: [] });
    }
    const ours = p.alliance;
    const others = (m.teams || []).filter((t) => t.teamNumber !== teamNumber);
    const toTeam = (t) => ({ number: t.teamNumber, name: t.team?.name || '' });
    const own = m.scores && m.scores[ours === 'Red' ? 'red' : 'blue'];
    const opp = m.scores && m.scores[ours === 'Red' ? 'blue' : 'red'];
    const score = own && opp ? { ours: own.totalPoints, theirs: opp.totalPoints } : null;

    events.get(p.eventCode).matches.push({
      id: m.id,
      label: matchLabel(m),
      level: m.tournamentLevel,
      time: m.scheduledStartTime || null,
      alliance: ours === 'Red' ? 'red' : 'blue',
      partners: others.filter((t) => t.alliance === ours).map(toTeam),
      opponents: others.filter((t) => t.alliance !== ours).map(toTeam),
      played: Boolean(m.hasBeenPlayed),
      score,
      outcome: score ? (score.ours > score.theirs ? 'win' : score.ours < score.theirs ? 'loss' : 'tie') : null,
    });
  }
  const list = [...events.values()];
  for (const e of list) e.matches.sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.id - b.id);
  return list.sort((a, b) => b.start.localeCompare(a.start));
}

module.exports = { eventLine, seasonLine, matchHistory };
