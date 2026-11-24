// Helpers shared by the exercise views. Date helpers are in ../../shared/dates.js.
import { pad } from "../../shared/dates.js";

// Units. Data is stored in kg, meters and seconds; these helpers convert for display and input.
// The preference is a per-device choice kept in localStorage (Settings changes it in step 9).
const UNITS_KEY = "exercise.units";
export const units = { weight: "kg", distance: "m" };
try {
  const u = JSON.parse(localStorage.getItem(UNITS_KEY) ?? "null");
  if (u && (u.weight === "kg" || u.weight === "lb")) units.weight = u.weight;
  if (u && (u.distance === "m" || u.distance === "km")) units.distance = u.distance;
} catch { /* storage unavailable or invalid: keep defaults */ }
export const saveUnits = () => { try { localStorage.setItem(UNITS_KEY, JSON.stringify(units)); } catch { /* ignore */ } };

const LB_PER_KG = 2.20462;
export const round = (n, d) => Number(Number(n).toFixed(d));
export const toDisplayWeight = (kg) => round(units.weight === "lb" ? kg * LB_PER_KG : kg, 1);
export const fromDisplayWeight = (v) => round(units.weight === "lb" ? v / LB_PER_KG : v, 3);
export const toDisplayDistance = (m) => (units.distance === "km" ? round(m / 1000, 3) : round(m, 1));
export const fromDisplayDistance = (v) => round(units.distance === "km" ? v * 1000 : v, 3);
export const fmtWeight = (kg) => `${toDisplayWeight(kg)} ${units.weight}`;
export const fmtDistance = (m) => `${toDisplayDistance(m)} ${units.distance}`;

// Durations are stored as seconds and shown as m:ss.
export const fmtDuration = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
// Accepts "90" (seconds) or "1:30". Returns whole seconds, or null when it can't be read.
export const parseDuration = (str) => {
  const s = String(str).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(\d+):([0-5]?\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// "" -> null (empty), "4,5" -> 4.5, junk -> NaN.
export const parseNum = (str) => {
  const s = String(str).trim().replace(",", ".");
  return s === "" ? null : /^\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};
