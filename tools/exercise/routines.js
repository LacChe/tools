// Library > Routines: shared workout templates. Only the creator edits; others can duplicate.
// A routine's exercises live in one jsonb array: [{ "exercise_id": 12, "sets": 3 }, ...]
import { sb } from "../../auth.js";
import { state, catalogById } from "./state.js";
import { t, nameOf } from "./i18n.js";
import { pickExercise } from "./picker.js";

const $ = (id) => document.getElementById(id);
const SELECT = "*, creator:hub_profiles!created_by(display_name)";
const rtName = (r) => nameOf(r) || t("unnamed");
const exLabel = (id) => { const e = catalogById().get(id); return e ? nameOf(e) || t("unnamed") : t("missingExercise"); };
const mine = (r) => r.created_by === state.userId;
const changed = () => document.dispatchEvent(new Event("exercise:routines"));
const sortByName = (a, b) => rtName(a).localeCompare(rtName(b));

const upsertLocal = (row) => {
  const i = state.routines.findIndex((r) => r.id === row.id);
  if (i >= 0) state.routines[i] = row; else state.routines.push(row);
  changed();
};

// Sub-tabs inside Library -------------------------------------------------------------------
const showSub = (which) => {
  const rt = which === "routines";
  $("libExBox").hidden = rt;
  $("libRtBox").hidden = !rt;
  $("libTabEx").setAttribute("aria-pressed", String(!rt));
  $("libTabRt").setAttribute("aria-pressed", String(rt));
};
$("libTabEx").addEventListener("click", () => showSub("exercises"));
$("libTabRt").addEventListener("click", () => showSub("routines"));

// List ----------------------------------------------------------------------------------------
const renderList = () => {
  const q = $("rtSearch").value.trim().toLowerCase();
  const showArchived = $("rtArchived").checked;
  const items = state.routines
    .filter((r) => (showArchived || !r.archived) && (!q || [r.name_en, r.name_zh].some((n) => n && n.toLowerCase().includes(q))))
    .sort(sortByName);
  const frag = document.createDocumentFragment();
  for (const r of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ex-row" + (r.archived ? " archived" : "");
    const n = document.createElement("span");
    n.className = "ex-name";
    n.textContent = rtName(r);
    const parts = [t("exerciseCount", { n: r.items.length })];
    if (r.creator?.display_name) parts.push(t("by", { name: r.creator.display_name }));
    if (r.archived) parts.push(t("archivedTag"));
    const m = document.createElement("span");
    m.className = "ex-meta";
    m.textContent = parts.join(" · ");
    b.append(n, m);
    b.addEventListener("click", () => openForm(r, mine(r) ? "edit" : "view"));
    frag.append(b);
  }
  $("rtList").replaceChildren(frag);
  $("rtEmpty").hidden = items.length > 0;
};

// Form ----------------------------------------------------------------------------------------
// form.mode: "create" | "edit" | "view". form.items: [{ exercise_id, sets }] being edited.
const form = { mode: "create", row: null, items: [] };
let armTimer = null;
const resetArm = () => { clearTimeout(armTimer); armTimer = null; $("rtDelete").textContent = t("delete"); };
const showError = (msg) => { $("rtError").textContent = msg; };

const renderItems = () => {
  const readOnly = form.mode === "view";
  const frag = document.createDocumentFragment();
  form.items.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "rt-item";
    const name = document.createElement("span");
    name.className = "rt-name" + (catalogById().has(it.exercise_id) ? "" : " missing");
    name.textContent = exLabel(it.exercise_id);
    if (readOnly) {
      const n = document.createElement("span");
      n.className = "ex-meta";
      n.textContent = `× ${it.sets}`;
      row.append(name, n);
    } else {
      const sets = document.createElement("input");
      sets.type = "text";
      sets.inputMode = "numeric";
      sets.className = "rt-sets";
      sets.value = String(it.sets);
      sets.setAttribute("aria-label", t("setsLabel"));
      sets.addEventListener("input", () => { it.sets = sets.value; });
      const mk = (label, aria, fn, disabled) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "icon-btn";
        b.textContent = label;
        b.setAttribute("aria-label", t(aria));
        b.disabled = disabled;
        b.addEventListener("click", fn);
        return b;
      };
      const move = (d) => () => { [form.items[i], form.items[i + d]] = [form.items[i + d], form.items[i]]; renderItems(); };
      row.append(
        name, sets,
        mk("↑", "moveUp", move(-1), i === 0),
        mk("↓", "moveDown", move(1), i === form.items.length - 1),
        mk("×", "remove", () => { form.items.splice(i, 1); renderItems(); }, false),
      );
    }
    frag.append(row);
  });
  $("rtItems").replaceChildren(frag);
};

// source: routine to pre-fill from (null = blank). blankNames: leave names empty (duplicate / save-as).
function openForm(source, mode, { blankNames = false, items = null } = {}) {
  form.mode = mode;
  form.row = mode === "create" ? null : source;
  form.items = (items ?? source?.items ?? []).map((i) => ({ exercise_id: i.exercise_id, sets: i.sets ?? 3 }));
  resetArm();
  showError("");
  const readOnly = mode === "view";
  $("rtTitle").textContent = t(mode === "create" ? "addRoutine" : mode === "edit" ? "editRoutine" : "viewRoutine");
  $("rtInfo").textContent = readOnly ? t("notYours", { name: source.creator?.display_name ?? "?" }) : "";
  $("rtNameEn").value = blankNames ? "" : (source?.name_en ?? "");
  $("rtNameZh").value = blankNames ? "" : (source?.name_zh ?? "");
  $("rtNotes").value = source?.notes ?? "";
  for (const id of ["rtNameEn", "rtNameZh", "rtNotes"]) $(id).disabled = readOnly;
  $("rtAddEx").hidden = readOnly;
  $("rtSave").hidden = readOnly;
  $("rtDuplicate").hidden = mode !== "view";
  $("rtArchive").hidden = mode !== "edit";
  $("rtDelete").hidden = mode !== "edit";
  if (mode === "edit") $("rtArchive").textContent = t(source.archived ? "unarchive" : "archive");
  renderItems();
  $("rtOverlay").classList.add("open");
}
const closeForm = () => $("rtOverlay").classList.remove("open");

// Used by Log's "Save as routine": a blank routine pre-filled with today's exercises.
export const openCreateRoutine = (items) => openForm(null, "create", { items, blankNames: true });

$("rtAddEx").addEventListener("click", async () => {
  const ex = await pickExercise();
  if (ex && $("rtOverlay").classList.contains("open")) { form.items.push({ exercise_id: ex.id, sets: 3 }); renderItems(); }
});

const mapError = (error) => {
  if (error.code === "23505") {
    const en = $("rtNameEn").value.trim().toLowerCase();
    const zh = $("rtNameZh").value.trim().toLowerCase();
    const hit = state.routines.find((r) => r.id !== form.row?.id && ((en && r.name_en?.toLowerCase() === en) || (zh && r.name_zh?.toLowerCase() === zh)));
    return showError(hit ? t("routineNameTaken", { name: rtName(hit) }) : t("badData"));
  }
  if (error.code === "23514") return showError(t("badData"));
  return showError(t("saveFail", { msg: error.message }));
};

$("rtForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (form.mode === "view") return;
  showError("");
  const name_en = $("rtNameEn").value.trim() || null; // empty becomes NULL: the database rejects empty strings
  const name_zh = $("rtNameZh").value.trim() || null;
  if (!name_en && !name_zh) return showError(t("needName"));
  if (!form.items.length) return showError(t("needItem"));
  const items = [];
  for (const it of form.items) {
    const raw = String(it.sets).trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 50) return showError(t("badSets"));
    items.push({ exercise_id: it.exercise_id, sets: Number(raw) });
  }
  const payload = { name_en, name_zh, notes: $("rtNotes").value.trim() || null, items };
  $("rtSave").disabled = true;
  const { data, error } = await (form.mode === "edit"
    ? sb.from("exercise_routines").update(payload).eq("id", form.row.id).select(SELECT).single()
    : sb.from("exercise_routines").insert(payload).select(SELECT).single());
  $("rtSave").disabled = false;
  if (error) return mapError(error);
  upsertLocal(data);
  closeForm();
});

$("rtDuplicate").addEventListener("click", () => openForm(form.row, "create", { blankNames: true }));

$("rtArchive").addEventListener("click", async () => {
  showError("");
  $("rtArchive").disabled = true;
  const { data, error } = await sb.from("exercise_routines").update({ archived: !form.row.archived }).eq("id", form.row.id).select(SELECT).single();
  $("rtArchive").disabled = false;
  if (error) return mapError(error);
  upsertLocal(data);
  closeForm();
});

// Two-tap delete: the first tap arms it, the second within 4 seconds confirms.
$("rtDelete").addEventListener("click", async () => {
  showError("");
  if (!armTimer) {
    $("rtDelete").textContent = t("deleteArm");
    armTimer = setTimeout(resetArm, 4000);
    return;
  }
  resetArm();
  $("rtDelete").disabled = true;
  const { error } = await sb.from("exercise_routines").delete().eq("id", form.row.id);
  $("rtDelete").disabled = false;
  if (error) return mapError(error);
  state.routines = state.routines.filter((r) => r.id !== form.row.id); // sessions that used it keep working (routine_id becomes NULL)
  changed();
  closeForm();
});

// Wiring ------------------------------------------------------------------------------------
$("rtNew").addEventListener("click", () => openForm(null, "create"));
for (const id of ["rtSearch", "rtArchived"]) $(id).addEventListener("input", renderList);
document.addEventListener("exercise:routines", renderList);
document.addEventListener("exercise:catalog", () => { renderList(); if ($("rtOverlay").classList.contains("open")) renderItems(); });
$("rtSearch").placeholder = t("search");
renderList();
