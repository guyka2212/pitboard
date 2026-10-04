export const COLOR_NAME = { red: 'Red', blue: 'Blue' };
export const OUTCOME_NAME = { win: 'Win', loss: 'Loss', tie: 'Tie' };

// FTC times are already in the venue's local time, so read them as-is instead of via Date.
export const matchTime = (iso) => (iso ? iso.slice(11, 16) : '');

export const shortDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export const fieldName = (field) => (field ? `Field ${field}` : '');

export const stat = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');


export const dayAndTime = (ms) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
