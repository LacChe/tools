// The colour of a day, as CSS. The tokens are in theme.css. Position colours show position only, not a medical phase.
const STOPS = ["--cycle-near", "--cycle-between-1", "--cycle-between-2", "--cycle-mid"];
const PAIN_MIX = { mild: 35, moderate: 65, severe: 92 };

const mix = (a, b, percentB) => `color-mix(in srgb, ${a}, ${b} ${Math.round(percentB)}%)`;

// index: day of the cycle from 0. Blue next to a period, to green half way, and back.
export function positionColor(index, cycleLength, periodLength) {
  const span = Math.max(1, cycleLength - periodLength - 1);
  const x = Math.min(1, Math.max(0, (index - periodLength) / span));
  const at = (1 - Math.abs(2 * x - 1)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(at));
  return mix(`var(${STOPS[i]})`, `var(${STOPS[i + 1]})`, (at - i) * 100);
}

// entry may be missing (unlogged). Any bleeding is one pink; pain darkens it toward plum, other days toward navy.
export function dayColor(entry, index, cycleLength, periodLength) {
  if (entry && entry.flow !== "none") return painColor("var(--cycle-bleed)", entry.pain);
  return painColor(positionColor(index, cycleLength, periodLength), entry?.pain, "var(--cycle-pain-off)");
}
export const painColor = (base, pain, toward = "var(--cycle-pain)") => (PAIN_MIX[pain] ? mix(base, toward, PAIN_MIX[pain]) : base);
