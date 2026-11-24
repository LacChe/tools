// Progress tab: one exercise's trend over time, drawn from its own primary metric.
// Different units are never mixed: exercises are grouped by primary metric and each group gets its own chart.
import { sb } from "../../auth.js";
import { state, catalogById } from "./state.js";
import { t, nameOf, getLang } from "./i18n.js";
import { pickExercise } from "./picker.js";
import { today, addDays, parseISO } from "../../shared/dates.js";
import { toDisplayWeight, fmtWeight, fmtDistance, fmtDuration } from "./common.js";

const $ = (id) => document.getElementById(id);
const exName = (e) => nameOf(e) || t("unnamed");
const NS = "http://www.w3.org/2000/svg";

// How each metric is read from the daily rows, combined across exercises, and shown.
const METRIC = {
  weight: { col: "top_weight", combine: Math.max, fmt: fmtWeight, title: "prWeight", axis: (v) => String(toDisplayWeight(v)) },
  volume: { col: "volume", combine: (a, b) => a + b, fmt: fmtWeight, title: "prVolume", axis: (v) => String(toDisplayWeight(v)) },
  duration: { col: "max_duration_sec", combine: Math.max, fmt: (v) => fmtDuration(Math.round(v)), title: "prDuration", axis: (v) => fmtDuration(Math.round(v)) },
  distance: { col: "total_distance_m", combine: (a, b) => a + b, fmt: fmtDistance, title: "prDistance", axis: (v) => String(Number(fmtDistance(v).split(" ")[0])) },
};

let exercise = null; // selected catalog row
let results = null; // [{ metric, ids, points: [{ date, value }] }] for the current selection
let stale = false;
let loadSeq = 0;

const dateFmt = (opts) => new Intl.DateTimeFormat(getLang() === "zh" ? "zh-CN" : "en", opts);
const longDate = (iso) => dateFmt({ year: "numeric", month: "short", day: "numeric" }).format(parseISO(iso));
const shortDate = (iso) => dateFmt({ month: "short", day: "numeric", year: "2-digit" }).format(parseISO(iso));

// Data -----------------------------------------------------------------------------------------
const selectedIds = () => {
  const ids = [exercise.id];
  if ($("prVariants").checked) for (const e of state.catalog) if (e.parent_id === exercise.id) ids.push(e.id);
  return ids;
};

const load = async () => {
  stale = false;
  renderPicker();
  if (!exercise) { results = null; return render(); }
  const seq = ++loadSeq;
  $("prError").textContent = "";
  $("prRetry").hidden = true;
  $("prBody").replaceChildren(Object.assign(document.createElement("p"), { className: "empty", textContent: t("loading") }));
  const ids = selectedIds();
  const from = $("prFrom").value || addDays(today(), -90);
  const to = $("prTo").value || today();
  const { data, error } = await sb.rpc("exercise_progress", { p_exercise_ids: ids, p_from: from, p_to: to });
  if (seq !== loadSeq) return;
  if (error) {
    results = null;
    $("prBody").replaceChildren();
    $("prError").textContent = t("prFail", { msg: error.message });
    $("prRetry").hidden = false;
    return;
  }
  // Group exercises by primary metric; within a group combine per day.
  const byId = catalogById();
  const groups = new Map(); // metric -> { ids: Set, days: Map(date -> value) }
  for (const row of data) {
    const metric = byId.get(row.exercise_id)?.primary_metric;
    if (!METRIC[metric]) continue;
    const raw = row[METRIC[metric].col];
    if (raw == null) continue;
    const v = Number(raw);
    if (!groups.has(metric)) groups.set(metric, { ids: new Set(), days: new Map() });
    const g = groups.get(metric);
    g.ids.add(row.exercise_id);
    g.days.set(row.entry_date, g.days.has(row.entry_date) ? METRIC[metric].combine(g.days.get(row.entry_date), v) : v);
  }
  results = [...groups].map(([metric, g]) => ({
    metric,
    ids: [...g.ids],
    points: [...g.days].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1)),
  }));
  render();
};

// Rendering ------------------------------------------------------------------------------------
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

const drawChart = (host, r) => {
  const { points, metric } = r;
  const m = METRIC[metric];
  const W = 360, H = 180, L = 46, R = 14, T = 12, B = 26;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = hi > lo ? (hi - lo) * 0.15 : (hi || 1) * 0.15;
  const yMin = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
  const yMax = hi + pad;
  const first = points[0].date, last = points.at(-1).date;
  const span = daysBetween(first, last);
  const x = (d) => (span === 0 ? (L + W - R) / 2 : L + (daysBetween(first, d) / span) * (W - L - R));
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);

  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "pr-chart", role: "img" });
  chart.setAttribute("aria-label", t(m.title));
  for (const v of [yMin, (yMin + yMax) / 2, yMax]) {
    chart.append(svg("line", { class: "pr-grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    const lab = svg("text", { class: "pr-label", x: L - 6, y: y(v) + 3, "text-anchor": "end" });
    lab.textContent = m.axis(v);
    chart.append(lab);
  }
  for (const [d, anchor, px] of [[first, "start", L], [last, "end", W - R]]) {
    if (d === last && first === last) continue;
    const lab = svg("text", { class: "pr-label", x: px, y: H - 8, "text-anchor": anchor });
    lab.textContent = shortDate(d);
    chart.append(lab);
  }
  chart.append(svg("polyline", { class: "pr-line", points: points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ") }));

  const readout = document.createElement("p");
  readout.className = "pr-readout";
  const dots = [];
  const select = (i) => {
    dots.forEach((d, j) => d.classList.toggle("active", i === j));
    readout.textContent = `${longDate(points[i].date)} · ${m.fmt(points[i].value)}`;
  };
  points.forEach((p, i) => {
    const g = svg("g", { tabindex: "0", role: "button", "aria-label": `${longDate(p.date)} ${m.fmt(p.value)}` });
    g.append(svg("circle", { class: "pr-hit", cx: x(p.date), cy: y(p.value), r: 14 }));
    const dot = svg("circle", { class: "pr-dot", cx: x(p.date), cy: y(p.value), r: 4 });
    g.append(dot);
    dots.push(dot);
    g.addEventListener("pointerenter", () => select(i));
    g.addEventListener("click", () => select(i));
    g.addEventListener("focus", () => select(i));
    chart.append(g);
  });
  select(points.length - 1);
  host.append(chart, readout);
};

const summary = (r) => {
  const m = METRIC[r.metric];
  const vals = r.points.map((p) => p.value);
  const latest = vals.at(-1);
  const best = Math.max(...vals);
  const delta = latest - vals[0];
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return [
    `${t("prLatest")}: ${m.fmt(latest)}`,
    `${t("prBest")}: ${m.fmt(best)}`,
    `${t("prChange")}: ${sign}${m.fmt(Math.abs(delta))}`,
  ].join(" · ");
};

const render = () => {
  const byId = catalogById();
  const body = $("prBody");
  body.replaceChildren();
  $("prHint").hidden = !!exercise;
  $("prEmpty").hidden = true;
  if (!exercise) return;
  if (!results) return;
  if (!results.length) { $("prEmpty").hidden = false; return; }
  for (const r of results) {
    const sec = document.createElement("section");
    sec.className = "pr-box";
    const title = document.createElement("h2");
    title.className = "sec-title";
    const names = r.ids.map((id) => (byId.has(id) ? exName(byId.get(id)) : "?")).join(", ");
    title.textContent = results.length > 1 || r.ids.length > 1 ? `${t(METRIC[r.metric].title)} · ${names}` : t(METRIC[r.metric].title);
    const sum = document.createElement("p");
    sum.className = "pr-summary";
    sum.textContent = summary(r);
    sec.append(title, sum);
    drawChart(sec, r);
    body.append(sec);
  }
};

const renderPicker = () => {
  $("prEx").textContent = exercise ? exName(exercise) : t("prChoose");
  const hasKids = !!exercise && state.catalog.some((e) => e.parent_id === exercise.id);
  $("prVarWrap").hidden = !hasKids;
  if (!hasKids) $("prVariants").checked = false;
};

// Wiring ------------------------------------------------------------------------------------
$("prEx").addEventListener("click", async () => {
  const ex = await pickExercise();
  if (ex) { exercise = ex; load(); }
});
$("prRetry").addEventListener("click", load);
for (const id of ["prVariants", "prFrom", "prTo"]) $(id).addEventListener("change", load);
for (const b of document.querySelectorAll("[data-range]")) {
  b.addEventListener("click", () => {
    const days = Number(b.dataset.range);
    $("prTo").value = today();
    $("prFrom").value = days ? addDays(today(), -days) : "2000-01-01";
    load();
  });
}

$("prFrom").value = addDays(today(), -90);
$("prTo").value = today();
renderPicker();
render();

document.addEventListener("exercise:changed", () => { stale = true; if (!$("progressView").hidden) load(); });
document.addEventListener("exercise:view", (ev) => { if (ev.detail?.view === "progress" && stale) load(); });
document.addEventListener("exercise:lang", () => { renderPicker(); render(); });
document.addEventListener("exercise:units", render);
document.addEventListener("exercise:catalog", () => {
  if (exercise) exercise = catalogById().get(exercise.id) ?? exercise;
  renderPicker();
  render();
});
