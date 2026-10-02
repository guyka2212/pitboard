// FTCScout GraphQL API: https://ftcscout.org/api
const ENDPOINT = 'https://api.ftcscout.org/graphql';
const TIMEOUT_MS = 20000;

class ScoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScoutError';
  }
}

async function query(text, variables = {}) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: text, variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.name;
    throw new ScoutError(`Can't reach FTCScout (${reason})`);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // handled below
  }
  if (!res.ok || !body) {
    const detail = body?.errors?.[0]?.message;
    throw new ScoutError(`FTCScout error (${res.status}${detail ? `: ${detail}` : ''})`);
  }
  // Partial errors are normal (e.g. one team that FTCScout doesn't know); only fail when nothing came back.
  if (!body.data) throw new ScoutError(body.errors?.[0]?.message || 'FTCScout error');
  return body.data;
}

module.exports = { query, ScoutError };
