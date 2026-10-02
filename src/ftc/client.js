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
  401: 'שם המשתמש או מפתח ה-API שגויים',
  404: 'האירוע לא נמצא',
  429: 'יותר מדי בקשות לשרת FTC, ננסה שוב בעוד רגע',
  503: 'שרת FTC לא זמין כרגע',
};

function createClient({ apiUsername, apiKey }) {
  const authorization = `Basic ${Buffer.from(`${apiUsername}:${apiKey}`).toString('base64')}`;

  async function get(pathAndQuery) {
    let res;
    try {
      res = await fetch(BASE_URL + pathAndQuery, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.name;
      throw new FtcApiError(`אין חיבור לשרת FTC (${reason})`, 0);
    }
    if (!res.ok) {
      throw new FtcApiError(STATUS_MESSAGES[res.status] || `שגיאה משרת FTC (${res.status})`, res.status);
    }
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new FtcApiError('תשובה לא תקינה משרת FTC', res.status);
    }
  }

  return { get };
}

module.exports = { createClient, FtcApiError };
