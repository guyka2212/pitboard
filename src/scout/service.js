const { query, ScoutError } = require('./client');
const { loadTypes, statsFragment, scoresFragment, statsSeasonFor } = require('./schema');
const { eventLine, seasonLine, matchHistory } = require('./transform');

const CACHE_MS = 60 * 1000;
const cache = new Map();

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const isTeamNumber = (n) => Number.isInteger(n) && n > 0 && n < 100000;

const QUICK_STATS = 'tot { value rank } auto { value } dc { value } count';

/**
 * Stats for every team at an event. `teams` comes from the FTC API, so the table works
 * even for events FTCScout hasn't picked up yet.
 */
async function eventTable({ season, eventCode, teams }) {
  const numbers = [...new Set(teams.map((t) => t.number))].filter(isTeamNumber);
  if (!numbers.length) throw new ScoutError('אין רשימת קבוצות לאירוע הזה עדיין');

  return cached(`event:${season}:${eventCode}:${numbers.join(',')}`, async () => {
    const types = await loadTypes();
    const statsSeason = statsSeasonFor(types, season);
    if (!statsSeason) throw new ScoutError('ל-FTCScout אין נתונים לעונה הזו');
    const stats = statsFragment(types);

    // Team numbers are checked integers, so inlining them into the aliases is safe.
    const perTeam = numbers.map((n) => `t${n}: teamByNumber(number: ${n}) {
      quickStats(season: $statsSeason) { ${QUICK_STATS} }
      events(season: $statsSeason) { stats { ${stats} } } }`);
    // Event stats only exist when FTCScout already covers this season.
    const withEvent = statsSeason === season;
    const eventPart = withEvent
      ? `event: eventByCode(season: $statsSeason, code: $code) { teams { teamNumber stats { ${stats} } } }`
      : '';
    const data = await query(
      `query ($statsSeason: Int!${withEvent ? ', $code: String!' : ''}) { ${eventPart} ${perTeam.join('\n')} }`,
      withEvent ? { statsSeason, code: eventCode } : { statsSeason },
    );

    const atEvent = new Map((data.event?.teams || []).map((t) => [t.teamNumber, eventLine(t.stats)]));
    const names = new Map(teams.map((t) => [t.number, t.name]));
    const rows = numbers.map((number) => {
      const team = data[`t${number}`];
      return {
        number,
        name: names.get(number) || '',
        event: atEvent.get(number) || null,
        season: team ? seasonLine(team.quickStats, team.events) : null,
      };
    });

    return {
      season,
      statsSeason,
      eventCode,
      hasEventStats: rows.some((r) => r.event),
      rows,
    };
  });
}

/** One team: stats at the current event, season stats and the season's match history. */
async function teamCard({ number, season, eventCode }) {
  if (!isTeamNumber(number)) throw new ScoutError('מספר קבוצה לא תקין');

  return cached(`team:${number}:${season}:${eventCode || ''}`, async () => {
    const types = await loadTypes();
    const statsSeason = statsSeasonFor(types, season);
    if (!statsSeason) throw new ScoutError('ל-FTCScout אין נתונים לעונה הזו');

    const data = await query(
      `query ($number: Int!, $statsSeason: Int!) {
        team: teamByNumber(number: $number) {
          number name
          location { city country }
          quickStats(season: $statsSeason) { ${QUICK_STATS} }
          events(season: $statsSeason) { eventCode stats { ${statsFragment(types)} } }
          matches(season: $statsSeason) {
            eventCode alliance
            event { name start }
            match {
              id matchNum series tournamentLevel description hasBeenPlayed scheduledStartTime
              scores { ${scoresFragment(types)} }
              teams { teamNumber alliance team { name } }
            }
          }
        }
      }`,
      { number, statsSeason },
    );

    const team = data.team;
    if (!team) throw new ScoutError(`קבוצה ${number} לא נמצאה ב-FTCScout`);
    const here = statsSeason === season && eventCode ? team.events.find((e) => e.eventCode === eventCode) : null;

    return {
      number: team.number,
      name: team.name,
      location: [team.location?.city, team.location?.country].filter(Boolean).join(', '),
      season,
      statsSeason,
      eventCode: eventCode || null,
      event: here ? eventLine(here.stats) : null,
      seasonStats: seasonLine(team.quickStats, team.events),
      history: matchHistory(team.matches, team.number),
    };
  });
}

module.exports = { eventTable, teamCard };
