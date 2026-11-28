// Number helpers shared by the apps. Pure: no DOM, no storage.

// "" -> null (empty), "4,5" -> 4.5, junk -> NaN.
export const parseNum = (str) => {
  const s = String(str).trim().replace(",", ".");
  return s === "" ? null : /^\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};
export const round = (n, d) => Number(Number(n).toFixed(d));
