// Library tab: browse, create, edit, archive, duplicate and delete exercises.
import { sb } from "../../auth.js";
import { state, catalogById } from "./state.js";
import { t, nameOf, labelOf } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const METRICS = ["reps", "weight", "duration", "distance"];
const SELECT = "*, creator:hub_profiles!created_by(display_name)";
const metricName = (m) => t("m" + m[0].toUpperCase() + m.slice(1));
const exName = (e) => nameOf(e) || t("unnamed");
const sortByName = (a, b) => exName(a).localeCompare(exName(b));
const changed = () => document.dispatchEvent(new Event("exercise:catalog"));
const mine = (e) => e.created_by === state.userId;

// Local state updates (no refetch) ------------------------------------------------------------
const upsertLocal = (row) => {
  const i = state.catalog.findIndex((e) => e.id === row.id);
  if (i >= 0) state.catalog[i] = row; else state.catalog.push(row);
  changed();
};
const removeLocal = (id) => {
  state.catalog = state.catalog.filter((e) => e.id !== id);
  for (const e of state.catalog) if (e.parent_id === id) e.parent_id = null; // database does the same (on delete set null)
  changed();
};

// List ----------------------------------------------------------------------------------------
const summary = (e) => {
  const req = e.required_metrics.map(metricName).join(" + ");
  return e.optional_metrics.length ? `${req}, ${t("optionalSuffix", { names: e.optional_metrics.map(metricName).join("/") })}` : req;
};

const matches = (e, q) => !q || [e.name_en, e.name_zh].some((n) => n && n.toLowerCase().includes(q));

const renderList = () => {
  const q = $("libSearch").value.trim().toLowerCase();
  const cat = $("libCat").value;
  const showArchived = $("libArchived").checked;
  const visible = state.catalog.filter((e) => (showArchived || !e.archived) && (!cat || e.category === cat) && matches(e, q));
  const ids = new Set(visible.map((e) => e.id));
  const byId = catalogById();
  const roots = visible.filter((e) => e.parent_id == null || !ids.has(e.parent_id)).sort(sortByName);
  const kids = new Map();
  for (const e of visible) {
    if (e.parent_id != null && ids.has(e.parent_id)) {
      if (!kids.has(e.parent_id)) kids.set(e.parent_id, []);
      kids.get(e.parent_id).push(e);
    }
  }
  const catLabel = new Map(state.categories.map((c) => [c.slug, labelOf(c)]));

  const row = (e, child) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ex-row" + (child ? " child" : "") + (e.archived ? " archived" : "");
    const n = document.createElement("span");
    n.className = "ex-name";
    n.textContent = exName(e);
    const parts = [];
    if (e.category && catLabel.has(e.category)) parts.push(catLabel.get(e.category));
    parts.push(summary(e));
    if (!child && e.parent_id != null && byId.has(e.parent_id)) parts.push(t("variantOf", { name: exName(byId.get(e.parent_id)) }));
    if (e.creator?.display_name) parts.push(t("by", { name: e.creator.display_name }));
    if (e.archived) parts.push(t("archivedTag"));
    const m = document.createElement("span");
    m.className = "ex-meta";
    m.textContent = parts.join(" · ");
    b.append(n, m);
    b.addEventListener("click", () => openForm(e, mine(e) ? "edit" : "view"));
    return b;
  };

  const frag = document.createDocumentFragment();
  for (const r of roots) {
    frag.append(row(r, false));
    for (const c of (kids.get(r.id) ?? []).sort(sortByName)) frag.append(row(c, true));
  }
  $("libList").replaceChildren(frag);
  $("libEmpty").hidden = visible.length > 0;
};

// Static pieces that depend on language ---------------------------------------------------------
const fillCategorySelects = () => {
  const keepFilter = $("libCat").value;
  const keepForm = $("exCategory").value;
  const filter = [new Option(t("allCategories"), "")];
  const form = [new Option(t("noCategory"), "")];
  for (const c of state.categories) {
    filter.push(new Option(labelOf(c), c.slug));
    form.push(new Option(labelOf(c), c.slug));
  }
  $("libCat").replaceChildren(...filter);
  $("exCategory").replaceChildren(...form);
  $("libCat").value = keepFilter;
  $("exCategory").value = keepForm;
};

const boxes = { req: {}, opt: {} };
const buildChecks = () => {
  for (const [kind, host] of [["req", $("exReq")], ["opt", $("exOpt")]]) {
    for (const m of METRICS) {
      const label = document.createElement("label");
      label.className = "check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", syncMetrics);
      const span = document.createElement("span");
      label.append(input, span);
      host.append(label);
      boxes[kind][m] = { input, span };
    }
  }
};
const labelChecks = () => {
  for (const kind of ["req", "opt"]) for (const m of METRICS) boxes[kind][m].span.textContent = metricName(m);
};

const chosen = (kind) => METRICS.filter((m) => boxes[kind][m].input.checked);

// A metric picked in one set is disabled in the other; the chart metric follows the picks.
function syncMetrics() {
  const readOnly = form.mode === "view";
  for (const m of METRICS) {
    boxes.req[m].input.disabled = readOnly || boxes.opt[m].input.checked;
    boxes.opt[m].input.disabled = readOnly || boxes.req[m].input.checked;
  }
  const all = new Set([...chosen("req"), ...chosen("opt")]);
  const opts = ["weight", "duration", "distance"].filter((m) => all.has(m));
  if (all.has("reps")) opts.push("volume");
  const keep = $("exPrimary").value;
  $("exPrimary").replaceChildren(...opts.map((m) => new Option(metricName(m), m)));
  $("exPrimary").value = opts.includes(keep) ? keep : (opts[0] ?? "");
}

// Form --------------------------------------------------------------------------------------
// form.mode: "create" | "edit" | "view"; form.row: the exercise being edited or viewed.
const form = { mode: "create", row: null, existing: null, onSaved: null };
let armTimer = null;
const resetArm = () => {
  clearTimeout(armTimer);
  armTimer = null;
  $("exDelete").textContent = t("delete");
};

const fillParents = (current, selfId, hasChildren) => {
  const opts = [new Option(t("noParent"), "")];
  for (const e of state.catalog.slice().sort(sortByName)) {
    if (e.id === selfId || e.parent_id != null) continue; // one level of nesting only
    if (e.archived && e.id !== current) continue;
    opts.push(new Option(exName(e), String(e.id)));
  }
  $("exParent").replaceChildren(...opts);
  $("exParent").value = current != null ? String(current) : "";
  $("exParent").disabled = form.mode === "view" || hasChildren; // an exercise with variants can't become one itself
};

// source: the row to pre-fill from (or null for blank). blankNames: leave names empty (duplicate).
function openForm(source, mode, blankNames = false, onSaved = null) {
  form.mode = mode;
  form.onSaved = onSaved;
  form.row = mode === "create" ? null : source;
  resetArm();
  $("exError").textContent = "";
  $("exOpenExisting").hidden = true;
  form.existing = null;

  const readOnly = mode === "view";
  $("exTitle").textContent = t(mode === "create" ? "addExercise" : mode === "edit" ? "editExercise" : "viewExercise");
  $("exInfo").textContent = readOnly ? t("notYours", { name: source.creator?.display_name ?? "?" }) : "";

  $("exNameEn").value = blankNames ? "" : (source?.name_en ?? "");
  $("exNameZh").value = blankNames ? "" : (source?.name_zh ?? "");
  $("exCategory").value = source?.category ?? "";
  for (const m of METRICS) {
    boxes.req[m].input.checked = !!source?.required_metrics.includes(m);
    boxes.opt[m].input.checked = !!source?.optional_metrics.includes(m);
  }
  $("exUnilateral").checked = !!source?.unilateral;
  const hasChildren = mode === "edit" && state.catalog.some((e) => e.parent_id === source.id);
  fillParents(source?.parent_id ?? null, mode === "edit" || mode === "view" ? source.id : null, hasChildren);
  syncMetrics();
  if (source?.primary_metric && [...$("exPrimary").options].some((o) => o.value === source.primary_metric)) $("exPrimary").value = source.primary_metric;

  for (const id of ["exNameEn", "exNameZh", "exCategory", "exPrimary", "exUnilateral"]) $(id).disabled = readOnly;
  $("exSave").hidden = readOnly;
  $("exDuplicate").hidden = mode !== "view";
  $("exArchive").hidden = mode !== "edit";
  $("exDelete").hidden = mode !== "edit";
  if (mode === "edit") $("exArchive").textContent = t(source.archived ? "unarchive" : "archive");
  $("exOverlay").classList.add("open");
}

const closeForm = () => $("exOverlay").classList.remove("open");

const showError = (msg, existing = null) => {
  $("exError").textContent = msg;
  form.existing = existing;
  $("exOpenExisting").hidden = !existing;
};

const mapError = (error) => {
  if (error.code === "23505") {
    const en = $("exNameEn").value.trim().toLowerCase();
    const zh = $("exNameZh").value.trim().toLowerCase();
    const hit = state.catalog.find((e) => e.id !== form.row?.id && ((en && e.name_en?.toLowerCase() === en) || (zh && e.name_zh?.toLowerCase() === zh)));
    if (hit) return showError(t(hit.archived ? "nameTakenArchived" : "nameTaken", { name: exName(hit) }), hit);
    return showError(t("badData"));
  }
  if (error.code === "23514") return showError(t("badData"));
  if (error.code === "23503") return showError(t("hasSets"));
  return showError(t("saveFail", { msg: error.message }));
};

$("exForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (form.mode === "view") return;
  showError("");
  const name_en = $("exNameEn").value.trim() || null; // empty becomes NULL: the database rejects empty strings
  const name_zh = $("exNameZh").value.trim() || null;
  if (!name_en && !name_zh) return showError(t("needName"));
  const required_metrics = chosen("req");
  if (!required_metrics.length) return showError(t("needMetric"));
  const payload = {
    name_en, name_zh,
    category: $("exCategory").value || null,
    parent_id: $("exParent").value ? Number($("exParent").value) : null,
    required_metrics,
    optional_metrics: chosen("opt"),
    primary_metric: $("exPrimary").value,
    unilateral: $("exUnilateral").checked,
  };
  $("exSave").disabled = true;
  const q = form.mode === "edit"
    ? sb.from("exercise_catalog").update(payload).eq("id", form.row.id).select(SELECT).single()
    : sb.from("exercise_catalog").insert(payload).select(SELECT).single();
  const { data, error } = await q;
  $("exSave").disabled = false;
  if (error) return mapError(error);
  upsertLocal(data);
  closeForm();
  form.onSaved?.(data); // e.g. the Log picker continues with the new exercise
});

$("exOpenExisting").addEventListener("click", () => {
  const e = form.existing;
  if (e) openForm(e, mine(e) ? "edit" : "view");
});
$("exDuplicate").addEventListener("click", () => openForm(form.row, "create", true));

$("exArchive").addEventListener("click", async () => {
  showError("");
  $("exArchive").disabled = true;
  const { data, error } = await sb.from("exercise_catalog").update({ archived: !form.row.archived }).eq("id", form.row.id).select(SELECT).single();
  $("exArchive").disabled = false;
  if (error) return mapError(error);
  upsertLocal(data);
  closeForm();
});

// Two-tap delete: the first tap arms it, the second within 4 seconds confirms.
$("exDelete").addEventListener("click", async () => {
  showError("");
  if (!armTimer) {
    $("exDelete").textContent = t("deleteArm");
    armTimer = setTimeout(resetArm, 4000);
    return;
  }
  resetArm();
  $("exDelete").disabled = true;
  const { error } = await sb.from("exercise_catalog").delete().eq("id", form.row.id);
  $("exDelete").disabled = false;
  if (error) return mapError(error); // 23503: sets reference it, so archive instead
  removeLocal(form.row.id);
  closeForm();
});

// Used by the Log picker: open the create form and call onSaved(row) once the exercise exists.
export const openCreate = (onSaved) => openForm(null, "create", false, onSaved);

// Wiring ------------------------------------------------------------------------------------
$("libNew").addEventListener("click", () => openForm(null, "create"));
for (const id of ["libSearch", "libCat", "libArchived"]) $(id).addEventListener("input", renderList);

const refreshStatic = () => {
  $("libSearch").placeholder = t("search");
  fillCategorySelects();
  labelChecks();
  if ($("exOverlay").classList.contains("open")) {
    const keepParent = $("exParent").value;
    fillParents(keepParent ? Number(keepParent) : null, form.row?.id ?? null, form.mode === "edit" && state.catalog.some((e) => e.parent_id === form.row.id));
    syncMetrics();
    $("exTitle").textContent = t(form.mode === "create" ? "addExercise" : form.mode === "edit" ? "editExercise" : "viewExercise");
    if (form.mode === "view") $("exInfo").textContent = t("notYours", { name: form.row.creator?.display_name ?? "?" });
    if (form.mode === "edit") $("exArchive").textContent = t(form.row.archived ? "unarchive" : "archive");
    resetArm();
  }
  renderList();
};

buildChecks();
refreshStatic();
document.addEventListener("exercise:lang", refreshStatic);
document.addEventListener("exercise:catalog", renderList);
