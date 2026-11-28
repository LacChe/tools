// The unit system for this device, kept in localStorage. Imports nothing.
// Falls back to "metric" when storage is unavailable or holds something else.
const KEY = "nutrition.units";

export const getSystem = () => {
  try {
    const s = localStorage.getItem(KEY);
    return s === "us" ? "us" : "metric";
  } catch { return "metric"; }
};

export const setSystem = (system) => {
  try { localStorage.setItem(KEY, system === "us" ? "us" : "metric"); } catch { /* storage unavailable: the choice lasts until reload */ }
};
