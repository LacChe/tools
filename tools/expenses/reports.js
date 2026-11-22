import { sb, requireAuth } from "../../auth.js";
import { pad, localISO, parseISO, monthBack, money, catColor } from "./common.js";

await requireAuth();
const $ = (id) => document.getElementById(id);
const status = $("status");

const fail = (msg) => {
  status.textContent = "Could not load data: " + msg;
  throw new Error("load failed");
};

const [cat, cur, set] = await Promise.all([
  sb.from("expenses_categories").select("*").order("sort_order"),
  sb.from("expenses_currencies").select("*").order("sort_order"),
  sb.from("expenses_settings").select("default_currency").maybeSingle(),
]);
for (const r of [cat, cur, set]) if (r.error) fail(r.error.message);
if (!cat.data.length) {
  status.textContent = "No access to this app.";
  throw new Error("no access");
}

const currencies = cur.data;
const catLabel = new Map(cat.data.map((c) => [c.slug, c.label_en]));
const catOrder = new Map(cat.data.map((c) => [c.slug, c.sort_order]));
const defaultCurrency =
  set.data && currencies.some((c) => c.code === set.data.default_currency)
    ? set.data.default_currency
    : currencies[0]?.code;

status.remove();
$("app").hidden = false;

for (const c of currencies) {
  const o = document.createElement("option");
  o.value = c.code;
  o.textContent = c.code;
  $("rCurrency").append(o);
}
$("rCurrency").value = defaultCurrency;
const now = new Date();
$("rTo").value = localISO(now);
$("rFrom").value = localISO(monthBack(now));

// Data ------------------------------------------------------------------
// The API returns at most 1000 rows per request, so read the range in pages.
const fetchRange = async (from, to, currency) => {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from("expenses_entries").select("entry_date,category,amount")
      .gte("entry_date", from).lte("entry_date", to).eq("currency", currency)
      .order("entry_date").order("id").range(i, i + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
};

// Drawing ---------------------------------------------------------------
const SVG = "http://www.w3.org/2000/svg";
const R = 48;
const C = 2 * Math.PI * R;
let view = null; // what is on screen: nets, posSum, net, currency
let selected = null;

const pctText = (p) => (p >= 10 ? `${Math.round(p)}%` : `${Math.round(p * 10) / 10}%`);

const paintSelection = () => {
  if (!view) return;
  for (const el of document.querySelectorAll("#donut .donut-slice, #typeList .row")) {
    el.classList.toggle("dim", Boolean(selected) && el.dataset.slug !== selected);
  }
  const v = selected ? view.nets.get(selected) : undefined;
  if (selected && v !== undefined) {
    $("donutAmt").textContent = money(v, view.currency);
    $("donutSub").textContent = (catLabel.get(selected) ?? selected) +
      (v > 0 && view.posSum > 0 ? ` · ${pctText((v / view.posSum) * 100)}` : "");
  } else {
    $("donutAmt").textContent = money(view.net, view.currency);
    $("donutSub").textContent = "";
  }
};
const select = (slug) => { selected = selected === slug ? null : slug; paintSelection(); };

const drawDonut = (pos, posSum) => {
  const svg = $("donut");
  svg.replaceChildren();
  const track = document.createElementNS(SVG, "circle");
  track.setAttribute("class", "donut-track");
  track.setAttribute("cx", "60");
  track.setAttribute("cy", "60");
  track.setAttribute("r", String(R));
  svg.append(track);
  const gap = pos.length > 1 ? 1.2 : 0;
  let acc = 0;
  for (const [slug, v] of pos) {
    const len = (v / posSum) * C;
    const c = document.createElementNS(SVG, "circle");
    c.setAttribute("class", "donut-slice");
    c.setAttribute("cx", "60");
    c.setAttribute("cy", "60");
    c.setAttribute("r", String(R));
    c.setAttribute("stroke-dasharray", `${Math.max(len - gap, 0.01)} ${C}`);
    c.setAttribute("stroke-dashoffset", String(-acc));
    c.style.stroke = catColor(slug);
    c.dataset.slug = slug;
    c.addEventListener("click", () => select(slug));
    svg.append(c);
    acc += len;
  }
};

const drawList = (pos, neg, posSum, currency) => {
  const list = $("typeList");
  list.replaceChildren();
  for (const [slug, v] of [...pos, ...neg]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "row";
    b.dataset.slug = slug;
    b.style.setProperty("--cat", catColor(slug));
    const l = document.createElement("span");
    l.textContent = catLabel.get(slug) ?? slug;
    const r = document.createElement("span");
    r.className = "amt";
    if (v > 0 && posSum > 0) {
      const p = document.createElement("span");
      p.className = "pct";
      p.textContent = pctText((v / posSum) * 100);
      r.append(p);
    }
    r.append(document.createTextNode(money(v, currency)));
    b.append(l, r);
    b.addEventListener("click", () => select(slug));
    list.append(b);
  }
};

// Trend strip: one stacked bar per day, week or month, depending on how long the range is.
const unitFor = (days) => (days <= 62 ? "day" : days <= 400 ? "week" : "month");
const keyOf = (dateStr, unit) => {
  if (unit === "day") return dateStr;
  if (unit === "month") return dateStr.slice(0, 7);
  const d = parseISO(dateStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return localISO(d);
};
const nextKey = (key, unit) => {
  if (unit === "month") {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  const d = parseISO(key);
  d.setDate(d.getDate() + (unit === "week" ? 7 : 1));
  return localISO(d);
};

const drawTrend = (rows, from, to, currency) => {
  const days = Math.round((parseISO(to) - parseISO(from)) / 86400000) + 1;
  const unit = unitFor(days);
  const keys = [];
  for (let k = keyOf(from, unit), end = keyOf(to, unit); k <= end; k = nextKey(k, unit)) keys.push(k);
  const buckets = new Map(keys.map((k) => [k, new Map()]));
  for (const r of rows) {
    const b = buckets.get(keyOf(r.entry_date, unit));
    if (b) b.set(r.category, (b.get(r.category) ?? 0) + Number(r.amount));
  }
  const bars = keys.map((k) => {
    const parts = [...buckets.get(k)].filter(([, v]) => v > 0)
      .sort((a, b) => (catOrder.get(a[0]) ?? 0) - (catOrder.get(b[0]) ?? 0));
    return { key: k, parts, total: parts.reduce((a, [, v]) => a + v, 0) };
  });
  const max = Math.max(...bars.map((b) => b.total), 0);
  const trend = $("trend");
  trend.replaceChildren();
  for (const b of bars) {
    const cell = document.createElement("div");
    cell.className = "tcell";
    cell.title = `${unit === "week" ? "Week of " : ""}${b.key}: ${money(b.total, currency)}`;
    if (max > 0 && b.total > 0) {
      const bar = document.createElement("div");
      bar.className = "tbar";
      bar.style.height = `${(b.total / max) * 100}%`;
      for (const [slug, v] of b.parts) {
        const seg = document.createElement("span");
        seg.className = "tseg";
        seg.style.flexGrow = String(v);
        seg.style.setProperty("--cat", catColor(slug));
        bar.append(seg);
      }
      cell.append(bar);
    }
    trend.append(cell);
  }
  $("trendTitle").textContent = `Spending per ${unit}`;
  $("trendFrom").textContent = keys[0];
  $("trendTo").textContent = keys[keys.length - 1];
};

const draw = (rows, from, to, currency) => {
  const nets = new Map();
  for (const r of rows) nets.set(r.category, (nets.get(r.category) ?? 0) + Number(r.amount));
  const list = [...nets].filter(([, v]) => Math.abs(v) >= 0.005);
  $("reportEmpty").hidden = list.length > 0;
  $("reportBody").hidden = list.length === 0;
  selected = null;
  if (!list.length) { view = null; return; }
  // Slices are the positive nets; a type with a negative net (refunds) is listed but has no slice.
  const pos = list.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const neg = list.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const posSum = pos.reduce((a, [, v]) => a + v, 0);
  const net = list.reduce((a, [, v]) => a + v, 0);
  view = { nets, posSum, net, currency };
  drawDonut(pos, posSum);
  drawList(pos, neg, posSum, currency);
  drawTrend(rows, from, to, currency);
  paintSelection();
};

// Controls --------------------------------------------------------------
let token = 0;
const update = async () => {
  const mine = ++token;
  $("reportError").textContent = "";
  const from = $("rFrom").value;
  const to = $("rTo").value;
  const currency = $("rCurrency").value;
  let rows;
  try {
    rows = await fetchRange(from, to, currency);
  } catch (e) {
    if (mine === token) $("reportError").textContent = e.message;
    return;
  }
  if (mine !== token) return; // a newer change replaced this one
  draw(rows, from, to, currency);
};

const limits = () => { $("rFrom").max = $("rTo").value; $("rTo").min = $("rFrom").value; };
const onRange = (changed) => {
  const f = $("rFrom");
  const t = $("rTo");
  if (!f.value || !t.value) return; // a cleared field: wait for a full date
  if (f.value > t.value) { if (changed === f) t.value = f.value; else f.value = t.value; }
  limits();
  update();
};
$("rFrom").addEventListener("change", () => onRange($("rFrom")));
$("rTo").addEventListener("change", () => onRange($("rTo")));
$("rCurrency").addEventListener("change", update);

limits();
update();
