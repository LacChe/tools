// The spiral. Today is at 12 o'clock; each day is 360° / cycle length, later days clockwise and further out.
// Bleeding raises the outer edge (flat on top), pain only changes the shade.
import { addDays, parseISO } from "../../shared/dates.js";
import { t, getLang } from "./i18n.js?v=6";
import { analyse, daysBetween, FLOWS } from "./rules.js?v=1";
import { dayColor, positionColor } from "./colors.js?v=2";

const NS = "http://www.w3.org/2000/svg";
// Sizes in drawing units.
const RADIUS = 200;   // inner edge of today
const PITCH = 58;     // how far the spiral moves out in one turn
const BASE = 24;      // height of a flat day
const LEVEL = 7;      // extra height per bleeding level
const GAP = 3;        // between days
const HISTORY = 1.5;  // cycles shown back from today...
const FADE = 0.3;     // ...the last of which fades out

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const levelOf = (entry) => Math.max(0, FLOWS.indexOf(entry?.flow ?? "none"));
const shortDate = (iso) => parseISO(iso).toLocaleDateString(getLang() === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });

// A closed band from day position a to b (in days from today, today's block being -0.5 to 0.5).
// inset shrinks it on every side, so an outline is drawn inside the shape.
function band(step, a, b, outer, { inset = 0, points = 96 } = {}) {
  const radius = (day) => RADIUS + PITCH * (day * step) / (2 * Math.PI);
  const trim = (GAP / 2 + inset) / radius((a + b) / 2) / step; // gap, in days
  const from = a + trim;
  const to = b - trim;
  const at = (day, r) => `${(r * Math.sin(day * step)).toFixed(2)} ${(-r * Math.cos(day * step)).toFixed(2)}`;
  const out = [];
  const back = [];
  for (let i = 0; i <= points; i++) {
    const day = from + (to - from) * (i / points);
    out.push(at(day, radius(day) + outer(day) - inset));
    back.push(at(day, radius(day) + inset));
  }
  return `M${out.join("L")}L${back.reverse().join("L")}Z`;
}

// Where a date falls in its cycle, for its colour.
function place(date, info) {
  const { periods, cycleLength } = info;
  if (!periods.length) return { index: ((daysBetween("2000-01-01", date) % cycleLength) + cycleLength) % cycleLength, length: cycleLength, period: 0 };
  let i = periods.length - 1;
  while (i >= 0 && periods[i].start > date) i--;
  if (i < 0) { // before the first logged period: count back from it
    const back = daysBetween(periods[0].start, date);
    return { index: ((back % cycleLength) + cycleLength) % cycleLength, length: cycleLength, period: periods[0].length };
  }
  const done = info.cycles[i];
  return { index: daysBetween(periods[i].start, date), length: done?.length ?? cycleLength, period: periods[i].length };
}

export function renderSpiral(box, entries, today, onPick) {
  const info = analyse(entries, today);
  const length = info.cycleLength;
  const step = (2 * Math.PI) / length;
  const oldest = -Math.round(HISTORY * length);
  const svg = svgEl("svg", { class: "spiral", role: "group", "aria-label": t("spiral") });
  let furthest = 0; // last day drawn, for the size

  const add = (d, attrs, style) => {
    const path = svgEl("path", { d, ...attrs });
    Object.assign(path.style, style);
    svg.append(path);
    return path;
  };

  // Past days and today.
  for (let k = oldest; k <= 0; k++) {
    const date = addDays(today, k);
    const entry = entries.get(date);
    const where = place(date, info);
    const color = dayColor(entry, where.index, where.length, where.period);
    const thickness = BASE + levelOf(entry) * LEVEL; // flat top: height alone shows the amount
    // The oldest stretch fades into the background while getting gently thinner.
    const fadeDays = FADE * length;
    const faded = (day) => Math.min(1, Math.max(0, (oldest + fadeDays - day) / fadeDays));
    const outer = (day) => thickness * (1 - 0.5 * faded(day));
    const shape = band(step, k - 0.5, k + 0.5, outer, { inset: entry ? 0 : 1.25 });
    const path = add(shape, { class: "day", "data-date": date, tabindex: 0, role: "button", "aria-label": shortDate(date) },
      entry ? { fill: color } : { fill: `color-mix(in srgb, ${color} 48%, transparent)`, stroke: color, strokeWidth: "2.5" });
    path.style.opacity = String(1 - 0.95 * faded(k));
    path.addEventListener("click", () => onPick(date));
    path.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(date); } });
  }

  // Forecast: faint outlines, then the band of possible start days.
  if (info.forecast) {
    const first = daysBetween(today, info.forecast.earliest);
    const last = daysBetween(today, info.forecast.latest);
    const flat = () => BASE;
    for (let k = 1; k < first; k++) {
      const where = place(addDays(today, k), info);
      add(band(step, k - 0.5, k + 0.5, flat, { inset: 1 }), { class: "future" },
        { stroke: positionColor(where.index, where.length, where.period) });
      furthest = k;
    }
    const start = Math.max(1, first);
    if (last >= start) {
      add(band(step, start - 0.5, last + 0.5, flat, { inset: 1, points: 40 * (last - start + 1) }), { class: "expected" });
      const text = info.forecast.earliest === info.forecast.latest
        ? shortDate(info.forecast.earliest) : `${shortDate(info.forecast.earliest)} – ${shortDate(info.forecast.latest)}`;
      svg.append(...arcText(step, start - 0.5, last + 0.5, text));
      furthest = last;
    }
  }

  const size = Math.ceil(RADIUS + PITCH * (furthest + 1) / length + BASE + 4 * LEVEL + 8);
  svg.setAttribute("viewBox", `${-size} ${-size} ${2 * size} ${2 * size}`);
  const day = svgEl("text", { class: "centre-day", x: 0, y: 4 });
  day.textContent = info.cycleDay === null ? "--" : t("cycleDay", { n: info.cycleDay });
  const date = svgEl("text", { class: "centre-date", x: 0, y: 40 });
  date.textContent = shortDate(today);
  svg.append(day, date);
  box.replaceChildren(svg);
}

// The date range written along the band, kept upright in the lower half.
function arcText(step, a, b, text) {
  const middle = (a + b) / 2;
  const angle = (((middle * step) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const flip = angle > Math.PI / 2 && angle < 1.5 * Math.PI;
  const radius = (day) => RADIUS + PITCH * (day * step) / (2 * Math.PI) + BASE / 2;
  const at = (day) => `${(radius(day) * Math.sin(day * step)).toFixed(2)} ${(-radius(day) * Math.cos(day * step)).toFixed(2)}`;
  const days = Array.from({ length: 41 }, (_, i) => (flip ? b - (b - a) * (i / 40) : a + (b - a) * (i / 40)));
  const guide = svgEl("path", { id: "expected-guide", d: `M${days.map(at).join("L")}`, fill: "none" });
  const room = radius(middle) * step * (b - a) - 8;
  const label = svgEl("text", { class: "expected-text" });
  const wide = [...text].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.55), 0);
  label.style.fontSize = `${Math.min(18, room / wide).toFixed(1)}px`;
  const along = svgEl("textPath", { href: "#expected-guide", startOffset: "50%" });
  along.textContent = text;
  label.append(along);
  return [guide, label];
}
