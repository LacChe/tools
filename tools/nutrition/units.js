// Pure: the unit table, conversion within one kind of unit, and formatting. May import only shared/numbers.js.
// Conversion never crosses kinds (a cup is not grams); that would need a food density database.
import { round } from "../../shared/numbers.js";

// factor converts to the kind's base: g for mass, ml for volume, 1 for counts.
export const UNITS = {
  g: { kind: "mass", factor: 1 },
  kg: { kind: "mass", factor: 1000 },
  oz: { kind: "mass", factor: 28.3495 },
  lb: { kind: "mass", factor: 453.592 },
  ml: { kind: "volume", factor: 1 },
  l: { kind: "volume", factor: 1000 },
  tsp: { kind: "volume", factor: 4.92892 },
  tbsp: { kind: "volume", factor: 14.7868 },
  cup: { kind: "volume", factor: 240 },
  fl_oz: { kind: "volume", factor: 29.5735 },
  piece: { kind: "count", factor: 1 },
  serving: { kind: "count", factor: 1 },
};

const LB_PER_KG = 2.20462; // same as the exercise app, so a weight reads the same in both

export const kindOf = (unit) => UNITS[unit]?.kind ?? null;

// Null when the kinds differ or a unit is unknown. The result is not rounded.
export const convert = (value, from, to) => {
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a || !b || a.kind !== b.kind) return null;
  return (value * a.factor) / b.factor;
};

// "0.25 cup": the label comes from t("unit_<code>").
export const formatQty = (value, unit, t) => `${round(value, 3)} ${t(`unit_${unit}`)}`;

// system is "metric" | "us".
export const displayWeight = (kg, system) => round(system === "us" ? kg * LB_PER_KG : kg, 1);
export const toKg = (value, system) => round(system === "us" ? value / LB_PER_KG : value, 3);
