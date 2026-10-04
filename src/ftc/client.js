// FTC Events API v2.0: https://ftc-events.firstinspires.org/api-docs/index.html
const BASE_URL = 'https://ftc-api.firstinspires.org/v2.0';
const TIMEOUT_MS = 15000;

class FtcApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FtcApiError';
    this.status = status;
  }
}

const STATUS_MESSAGES = {
  401: 'The FTC API username or key is wrong',
  404: 'Event not found',
  429: 'Too many requests to the FTC server, retrying shortly',
  503: 'The FTC server is unavailable right now',
};

function createClient({ apiUsername, apiKey }) {
  const authorization = `Basic ${Buffer.from(`${apiUsername}:${apiKey}`).toString('base64')}`;

  /** The parsed body plus when FTC last changed that data (Last-Modified), as epoch ms or null. */
  async function request(pathAndQuery) {
    let res;
    try {
      res = await fetch(BASE_URL + pathAndQuery, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.name;
      throw new FtcApiError(`Can't reach the FTC server (${reason})`, 0);
    }
    if (!res.ok) {
      throw new FtcApiError(STATUS_MESSAGES[res.status] || `FTC server error (${res.status})`, res.status);
    }
    const modified = Date.parse(res.headers.get('last-modified') || '');
    const lastModified = Number.isFinite(modified) ? modified : null;
    const text = await res.text();
    if (!text) return { data: {}, lastModified };
    try {
      return { data: JSON.parse(text), lastModified };
    } catch {
      throw new FtcApiError('Invalid response from the FTC server', res.status);
    }
  }

  const get = async (pathAndQuery) => (await request(pathAndQuery)).data;

  return { get, request };
}

module.exports = { createClient, FtcApiError };
