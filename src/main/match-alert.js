const MATCHES_BEFORE = 2;

/** Decides when to warn that our match is coming up. Each match is announced once. */
class MatchAlert {
  constructor(matchesBefore = MATCHES_BEFORE) {
    this.matchesBefore = matchesBefore;
    this.announced = new Set();
  }

  /** Returns the match to announce, or null. */
  check(data) {
    // Counting matches on data FTC hasn't updated today would send people running for nothing.
    if (!data || data.ftcNotSyncedToday) return null;
    const next = data.nextMatch;
    if (!next || !Number.isInteger(next.matchesBefore) || next.matchesBefore > this.matchesBefore) return null;
    const key = `${data.event && data.event.code}:${data.teamNumber}:${next.key}`;
    if (this.announced.has(key)) return null;
    this.announced.add(key);
    return next;
  }
}

function describe(match) {
  const color = match.alliance === 'red' ? 'Red' : 'Blue';
  const partners = match.partners.map((t) => t.display).join(', ');
  const before = match.matchesBefore === 0 ? 'Our match is up next!' : `${match.matchesBefore} matches until ours`;
  const field = match.field ? ` · Field ${match.field}` : '';
  return { title: before, body: `${match.label} · ${color}${field}${partners ? ` · with ${partners}` : ''}` };
}

module.exports = { MatchAlert, describe, MATCHES_BEFORE };
