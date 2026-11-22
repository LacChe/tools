import { sb, requireAuth } from "../../auth.js";

const UI = {
  zh: {
    h1: "练习依赖关系图",
    home: "主页",
    subtitle: "列 = 建构阶段（左：基础，右：依赖最多）。同列内按由浅入深排列。点击方块查看该练习的完整条目，点击连线可单独追踪一条依赖关系。",
    legendWF: "《编织命运》",
    legendSW: "《六合》",
    legendReq: "以此为基础／必要",
    legendOpt: "可搭配／可选",
    hint: "点击空白处可重置",
    footnote: "回环状虚线表示一种反向引用（例如「行于甬道」与「热病石」互相引用）。",
  },
  en: {
    h1: "Practice Dependency Web",
    home: "Home",
    subtitle: "Columns = build-order stage (left = foundational, right = depends on the most). Click a box for its cheat-sheet entry, click a line to trace a single connection.",
    legendWF: "Weaving Fate",
    legendSW: "Six Ways",
    legendReq: "builds on / requires",
    legendOpt: "pairs with / optional",
    hint: "click empty space to reset",
    footnote: "Loop-shaped dashed lines below a pair indicate a back-reference (e.g. Walking the Corridor ↔ The Fever Stone).",
  },
};
const BOOK = {
  wf: { en: "Weaving Fate", zh: "编织命运" },
  sw: { en: "Six Ways", zh: "六合" },
};
const NS = "http://www.w3.org/2000/svg";
const COLOR = { wf: "var(--accent)", sw: "var(--accent-2)" };

let lang = "en";
let activeEl = null;
let selectedEdge = null;
const byId = new Map();

await requireAuth();
const status = document.getElementById("status");

const [ex, ln] = await Promise.all([
  sb.from("wachter_items").select("*").order("id"),
  sb.from("wachter_links").select("*"),
]);
if (ex.error || ln.error || !ex.data.length) {
  status.textContent = "Could not load data: " + (ex.error?.message || ln.error?.message || "no rows");
  throw new Error("load failed");
}
status.remove();
document.getElementById("app").hidden = false;

const px = (r) => ({ x: 110 + r.col * 235, y: 114 + Number(r.row) * 108 });
ex.data.forEach((r) => byId.set(r.id, r));

const canvas = document.getElementById("canvas");
const svg = document.getElementById("edges");

// Edges
for (const l of ln.data) {
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
  line.style.stroke = COLOR[a.book];
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
  el.style.setProperty("--node-accent", COLOR[r.book]);
  const num = document.createElement("span");
  num.className = "node-num";
  num.textContent = r.id;
  const label = document.createElement("span");
  label.className = "node-label";
  el.append(num, label);
  canvas.append(el);
}

const overlay = document.getElementById("overlay");
const panelBook = document.getElementById("panelBook");
const panelTitle = document.getElementById("panelTitle");
const panelBody = document.getElementById("panelBody");

function renderPanel(id) {
  const r = byId.get(Number(id));
  panelBook.textContent = BOOK[r.book][lang];
  panelTitle.textContent = r["title_" + lang];
  // Trusted: owner's own content from an RLS-protected table.
  panelBody.innerHTML = r["body_" + lang];
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = UI[lang][el.dataset.i18n]; });
  document.querySelectorAll(".node-box").forEach((el) => {
    const r = byId.get(Number(el.dataset.node));
    el.querySelector(".node-label").textContent = r["label_" + lang];
    el.setAttribute("aria-label", r["title_" + lang]);
  });
  document.getElementById("btnZh").classList.toggle("active", lang === "zh");
  document.getElementById("btnEn").classList.toggle("active", lang === "en");
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  if (activeEl) renderPanel(activeEl.dataset.node);
}
document.getElementById("btnZh").addEventListener("click", () => { lang = "zh"; applyLanguage(); });
document.getElementById("btnEn").addEventListener("click", () => { lang = "en"; applyLanguage(); });

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
document.getElementById("panelClose").addEventListener("click", closePanel);
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
document.getElementById("frame").addEventListener("click", clearEdgeSelection);

applyLanguage();
