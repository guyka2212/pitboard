export const COLOR_NAME = { red: 'אדום', blue: 'כחול' };
export const OUTCOME_NAME = { win: 'ניצחון', loss: 'הפסד', tie: 'תיקו' };

// FTC times are already in the venue's local time, so read them as-is instead of via Date.
export const matchTime = (iso) => (iso ? iso.slice(11, 16) : '');

export const shortDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export const clock = (ms) => new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
