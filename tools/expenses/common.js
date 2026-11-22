// Helpers shared by the records page (app.js) and the reports page (reports.js).

// Local-date helpers (never toISOString: it returns the UTC date).
export const pad = (n) => String(n).padStart(2, "0");
export const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => localISO(new Date());
export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
// Same day one month earlier, clamped to the month's length (Mar 31 -> Feb 28, not Mar 3).
export const monthBack = (d) => {
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
};

export const fmt = (n) => String(Number(Number(n).toFixed(2)));

// "¥781", "-$20", "CHF 40": symbol from the browser, so no per-currency data is needed.
const symbols = new Map();
export const money = (n, code) => {
  if (!symbols.has(code)) {
    let s = code;
    try {
      s = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
        .formatToParts(0).find((p) => p.type === "currency")?.value ?? code;
    } catch { /* unknown code: show it as-is */ }
    symbols.set(code, /^[A-Za-z]+$/.test(s) ? s + " " : s);
  }
  const v = Number(n);
  return `${v < 0 ? "-" : ""}${symbols.get(code)}${fmt(Math.abs(v))}`;
};

// Category color token for a slug (defined in base.css, themeable); unknown slugs fall back to --muted.
export const catColor = (slug) => `var(--cat-${String(slug).replace(/[^a-z0-9_-]/gi, "")}, var(--muted))`;
