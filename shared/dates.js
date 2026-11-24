// Local-date helpers shared by the apps. Dates travel as "YYYY-MM-DD" strings.
// Never use toISOString() for these: it returns the UTC date, which is wrong near midnight.

export const pad = (n) => String(n).padStart(2, "0");
export const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => localISO(new Date());
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return localISO(d); };
