// Exercise picker overlay, shared by the Log tab and the routine form.
// pickExercise() resolves with the chosen (or newly created) catalog row, or null if a newer pick replaced it.
import { sb } from "../../auth.js";
import { state } from "./state.js";
import { t, nameOf } from "./i18n.js";
import { openCreate } from "./library.js";

const $ = (id) => document.getElementById(id);
const exName = (e) => nameOf(e) || t("unnamed");

let recentIds = null; // exercise ids, most recently used first
export const resetRecents = () => { recentIds = null; };
const loadRecents = async () => {
  if (recentIds) return recentIds;
  const { data, error } = await sb.from("exercise_sets").select("exercise_id").order("id", { ascending: false }).limit(300);
  recentIds = error ? [] : [...new Set(data.map((r) => r.exercise_id))];
  return recentIds;
};

let resolver = null;
const settle = (value) => { const r = resolver; resolver = null; r?.(value); };

const render = async () => {
  const q = $("pickSearch").value.trim().toLowerCase();
  const rank = new Map((await loadRecents()).map((id, i) => [id, i]));
  const items = state.catalog
    .filter((e) => !e.archived && (!q || [e.name_en, e.name_zh].some((n) => n && n.toLowerCase().includes(q))))
    .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || exName(a).localeCompare(exName(b)));
  const frag = document.createDocumentFragment();
  for (const e of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ex-row";
    const n = document.createElement("span");
    n.className = "ex-name";
    n.textContent = exName(e);
    b.append(n);
    b.addEventListener("click", () => { $("pickOverlay").classList.remove("open"); settle(e); });
    frag.append(b);
  }
  $("pickList").replaceChildren(frag);
  $("pickEmpty").hidden = items.length > 0;
};

export const pickExercise = () => {
  settle(null); // a pick that was never finished is abandoned
  return new Promise((resolve) => {
    resolver = resolve;
    $("pickSearch").value = "";
    render().then(() => $("pickOverlay").classList.add("open"));
  });
};

$("pickSearch").addEventListener("input", render);
$("pickNew").addEventListener("click", () => {
  $("pickOverlay").classList.remove("open");
  openCreate((row) => settle(row));
});
