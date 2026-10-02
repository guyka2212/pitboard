const MATCHES_BEFORE = 2;

/** Decides when to warn that our match is coming up. Each match is announced once. */
class MatchAlert {
  constructor(matchesBefore = MATCHES_BEFORE) {
    this.matchesBefore = matchesBefore;
    this.announced = new Set();
  }

  /** Returns the match to announce, or null. */
  check(data) {
    const next = data && data.nextMatch;
    if (!next || !Number.isInteger(next.matchesBefore) || next.matchesBefore > this.matchesBefore) return null;
    const key = `${data.event && data.event.code}:${data.teamNumber}:${next.key}`;
    if (this.announced.has(key)) return null;
    this.announced.add(key);
    return next;
  }
}

function describe(match) {
  const color = match.alliance === 'red' ? 'אדום' : 'כחול';
  const partners = match.partners.map((t) => t.display).join(', ');
  const before = match.matchesBefore === 0 ? 'המשחק שלנו הבא בתור!' : `עוד ${match.matchesBefore} משחקים למשחק שלנו`;
  return { title: before, body: `${match.label} · ${color}${partners ? ` · עם ${partners}` : ''}` };
}

module.exports = { MatchAlert, describe, MATCHES_BEFORE };
