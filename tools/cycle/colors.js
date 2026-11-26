// The colour of a day, as CSS. The tokens are in theme.css. Position colours show position only, not a medical phase.
const STOPS = ["--cycle-near", "--cycle-between-1", "--cycle-between-2", "--cycle-mid"];
const PAIN_MIX = { mild: 35, moderate: 65, severe: 92 };

const mix = (a, b, percentB) => `color-mix(in srgb, ${a}, ${b} ${Math.round(percentB)}%)`;

// index: day of the cycle from 0. Lilac next to a period, through blue to teal half way, and back.
export function positionColor(index, cycleLength, periodLength) {
  const span = Math.max(1, cycleLength - periodLength - 1);
  const x = Math.min(1, Math.max(0, (index - periodLength) / span));
  const at = (1 - Math.abs(2 * x - 1)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(at));
  return mix(`var(${STOPS[i]})`, `var(${STOPS[i + 1]})`, (at - i) * 100);
}

// entry may be missing (unlogged). Any bleeding is one pink; pain mixes toward plum.
export function dayColor(entry, index, cycleLength, periodLength) {
  const base = entry && entry.flow !== "none" ? "var(--cycle-bleed)" : positionColor(index, cycleLength, periodLength);
  return painColor(base, entry?.pain);
}
export const painColor = (base, pain) => (PAIN_MIX[pain] ? mix(base, "var(--cycle-pain)", PAIN_MIX[pain]) : base);
