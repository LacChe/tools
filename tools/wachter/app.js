import { sb, requireAuth } from "../../auth.js";
import { t, getLang, applyStatic } from "./i18n.js";
import { safeFragment } from "./sanitize.js";

const NS = "http://www.w3.org/2000/svg";
const COLOR = { wf: "var(--accent)", sw: "var(--accent-2)" };
const BOOK_KEY = { wf: "bookWf", sw: "bookSw" };

// Layout: a node's centre is at (X0 + col * COL_W, Y0 + row * ROW_H). The canvas is at least the size of the
// original layout and grows if the data reaches further, so a new column or row is never cut off.
const X0 = 110, Y0 = 114, COL_W = 235, ROW_H = 108, NODE_W = 150;
const MIN_W = 2030, MIN_H = 1740;
const px = (r) => ({ x: X0 + r.col * COL_W, y: Y0 + Number(r.row) * ROW_H });

let activeEl = null;
let selectedEdge = null;
const byId = new Map();
const $ = (id) => document.getElementById(id);
const field = (r, name) => r[`${name}_${getLang()}`];

applyStatic(); // so "Loading…" and the title are already in the saved language
await requireAuth();
const status = $("status");

const [ex, ln] = await Promise.all([
  sb.from("wachter_items").select("*").order("id"),
  sb.from("wachter_links").select("*"),
]);
if (ex.error || ln.error || !ex.data.length) {
  status.textContent = t("loadFail", { msg: ex.error?.message || ln.error?.message || "no rows" });
  throw new Error("load failed");
}
status.remove();
$("app").hidden = false;

ex.data.forEach((r) => byId.set(r.id, r));

// Links that point at an item that is not there are skipped instead of breaking the whole diagram.
const links = ln.data.filter((l) => {
  const ok = byId.has(l.from_id) && byId.has(l.to_id);
  if (!ok) console.warn(`wachter: link ${l.from_id} -> ${l.to_id} points at a missing item; skipped`);
  return ok;
});

const canvas = $("canvas");
const svg = $("edges");

// Canvas size from the data (never smaller than the original layout).
const points = ex.data.map(px);
const width = Math.max(MIN_W, Math.max(...points.map((p) => p.x)) + NODE_W / 2 + (X0 - NODE_W / 2));
const height = Math.max(MIN_H, Math.max(...points.map((p) => p.y)) + Y0);
canvas.style.width = width + "px";
canvas.style.height = height + "px";
svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

// Edges
for (const l of links) {
  const a = byId.get(l.from_id), b = byId.get(l.to_id);
  const pa = px(a), pb = px(b);
  let d;
  if (l.back_ref) {
    const x1 = pa.x + 0, y1 = pa.y + 22, x2 = pb.x, y2 = pb.y + 22;
    d = `M ${x1} ${y1} C ${x1} ${y1 + 100}, ${x2} ${y1 + 100}, ${x2} ${y2}`;
  } else {
    const x1 = pa.x + 75, x2 = pb.x - 75, mx = (x1 + x2) / 2;
    d = `M ${x1} ${pa.y} C ${mx} ${pa.y}, ${mx} ${pb.y}, ${x2} ${pb.y}`;
  }
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "edge-group");
  g.dataset.id = `e-${l.from_id}-${l.to_id}`;
  const hit = document.createElementNS(NS, "path");
  hit.setAttribute("class", "edge-hit");
  hit.setAttribute("d", d);
  const line = document.createElementNS(NS, "path");
  line.setAttribute("class", "edge-line");
  line.setAttribute("d", d);
  line.style.stroke = COLOR[a.book] ?? "var(--muted)";
  const optional = l.kind === "optional";
  line.setAttribute("opacity", optional ? "0.5" : "0.7");
  if (optional) line.setAttribute("stroke-dasharray", "4 5");
  g.append(hit, line);
  svg.append(g);
}

// Nodes
for (const r of ex.data) {
  const p = px(r);
  const el = document.createElement("div");
  el.className = "node-box";
  el.dataset.node = r.id;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
  el.style.setProperty("--node-accent", COLOR[r.book] ?? "var(--muted)");
  const num = document.createElement("span");
  num.className = "node-num";
  num.textContent = r.id;
  const label = document.createElement("span");
  label.className = "node-label";
  el.append(num, label);
  canvas.append(el);
}

const overlay = $("overlay");
const panelBook = $("panelBook");
const panelTitle = $("panelTitle");
const panelBody = $("panelBody");

function renderPanel(id) {
  const r = byId.get(Number(id));
  panelBook.textContent = BOOK_KEY[r.book] ? t(BOOK_KEY[r.book]) : r.book;
  panelTitle.textContent = field(r, "title");
  // The body is HTML from the database; only known-safe tags and attributes get through (see sanitize.js).
  panelBody.replaceChildren(safeFragment(field(r, "body")));
}

// Everything that depends on the language and is not a plain [data-i18n] element.
function renderLanguage() {
  document.querySelectorAll(".node-box").forEach((el) => {
    const r = byId.get(Number(el.dataset.node));
    el.querySelector(".node-label").textContent = field(r, "label");
    el.setAttribute("aria-label", field(r, "title"));
  });
  if (activeEl) renderPanel(activeEl.dataset.node);
}

function openNode(id) {
  renderPanel(id);
  overlay.classList.add("open");
  activeEl?.classList.remove("active");
  activeEl = document.querySelector(`.node-box[data-node="${id}"]`);
  activeEl?.classList.add("active");
}
const closePanel = () => overlay.classList.remove("open");

document.querySelectorAll(".node-box").forEach((n) => {
  n.addEventListener("click", (e) => { e.stopPropagation(); openNode(n.dataset.node); });
  n.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNode(n.dataset.node); }
  });
});
$("panelClose").addEventListener("click", closePanel);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closePanel(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

const edgeGroups = document.querySelectorAll(".edge-group");
function clearEdgeSelection() {
  edgeGroups.forEach((g) => g.classList.remove("selected", "dimmed"));
  selectedEdge = null;
}
edgeGroups.forEach((g) => {
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedEdge === g) { clearEdgeSelection(); return; }
    edgeGroups.forEach((o) => {
      o.classList.toggle("selected", o === g);
      o.classList.toggle("dimmed", o !== g);
    });
    selectedEdge = g;
  });
});
$("frame").addEventListener("click", clearEdgeSelection);

renderLanguage();
