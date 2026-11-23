// Log tab: record a day's sets. Every set is saved the moment it is added.
import { sb } from "../../auth.js";
import { state, catalogById } from "./state.js";
import { t, nameOf, getLang } from "./i18n.js";
import { openCreate } from "./library.js";
import {
  today, localISO, parseISO, units, toDisplayWeight, fromDisplayWeight, toDisplayDistance, fromDisplayDistance,
  fmtWeight, fmtDistance, fmtDuration, parseDuration, parseNum,
} from "./common.js";

const $ = (id) => document.getElementById(id);
const METRICS = ["reps", "weight", "duration", "distance"];
const metricName = (m) => t("m" + m[0].toUpperCase() + m.slice(1));
const exName = (e) => (e ? nameOf(e) || t("unnamed") : t("missingExercise"));
const changed = () => document.dispatchEvent(new Event("exercise:changed"));
const open = (id) => $(id).classList.add("open");
const close = (id) => $(id).classList.remove("open");

// Day state ------------------------------------------------------------------------------------
let cur = { date: null, session: null, sets: [] };
let loadSeq = 0;
const lastCache = new Map(); // "exerciseId|date" -> sets of that exercise's previous session
let recentIds = null; // exercise ids, most recently used first; reset whenever sets change

const showError = (msg) => { $("logError").textContent = msg; };
const bumpCaches = () => { lastCache.clear(); recentIds = null; };

const hashDate = () => {
  const m = /^#log\?date=(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
  return m ? m[1] : null;
};
const setHash = (date) => {
  const view = location.hash.slice(1).split("?")[0];
  if (view && view !== "log") return; // another tab is showing: leave the hash alone
  try { history.replaceState(null, "", date === today() ? "#log" : `#log?date=${date}`); } catch { /* ignore */ }
};
const shiftDate = (date, days) => { const d = parseISO(date); d.setDate(d.getDate() + days); return localISO(d); };

// Formatting -----------------------------------------------------------------------------------
// One compact value: "10", "10 @ 45 kg", "0:30", "50 m @ 50 kg".
const compact = (s) => {
  let main = "";
  if (s.reps != null) main = String(s.reps);
  else if (s.duration_sec != null) main = fmtDuration(s.duration_sec);
  else if (s.distance_m != null) main = fmtDistance(s.distance_m);
  if (s.reps != null && s.duration_sec != null) main += ` · ${fmtDuration(s.duration_sec)}`;
  if (s.reps != null && s.distance_m != null) main += ` · ${fmtDistance(s.distance_m)}`;
  if (s.weight != null) main = main ? `${main} @ ${fmtWeight(s.weight)}` : fmtWeight(s.weight);
  return main || "–";
};
const sideLabel = (side) => (side === "left" ? t("sideLeft") : side === "right" ? t("sideRight") : "");
const setText = (s) => {
  const bits = [s.reps != null && s.weight != null ? `${s.reps} × ${fmtWeight(s.weight)}` : compact(s)];
  if (s.side) bits.push(sideLabel(s.side));
  if (s.is_warmup) bits.push(t("warmupTag"));
  return bits.join(" · ");
};
// "3 × 10 @ 45 kg" for identical sets, otherwise the sets one after another.
const summarize = (sets) => {
  const out = [];
  for (const s of sets) {
    const key = JSON.stringify([s.reps, s.weight, s.duration_sec, s.distance_m, s.side]);
    const last = out[out.length - 1];
    if (last && last.key === key) last.n += 1; else out.push({ key, n: 1, text: compact(s) + (s.side ? ` ${sideLabel(s.side)}` : "") });
  }
  return out.map((g) => (g.n > 1 ? `${g.n} × ${g.text}` : g.text)).join(", ");
};

// Data -----------------------------------------------------------------------------------------
// The user's previous session of an exercise before `date`: its sets, or [] when there is none.
const lastSession = async (exId, date) => {
  const key = `${exId}|${date}`;
  if (lastCache.has(key)) return lastCache.get(key);
  const { data, error } = await sb.from("exercise_sessions")
    .select("entry_date, exercise_sets!inner(*)")
    .eq("exercise_sets.exercise_id", exId).lt("entry_date", date)
    .order("entry_date", { ascending: false }).limit(1);
  if (error) { console.warn("last session lookup failed", error.message); return []; }
  const sets = (data[0]?.exercise_sets ?? []).slice().sort((a, b) => a.position - b.position);
  lastCache.set(key, sets);
  return sets;
};

const loadRecents = async () => {
  if (recentIds) return recentIds;
  const { data, error } = await sb.from("exercise_sets").select("exercise_id").order("id", { ascending: false }).limit(300);
  recentIds = error ? [] : [...new Set(data.map((r) => r.exercise_id))];
  return recentIds;
};

const load = async (date) => {
  const seq = ++loadSeq;
  cur = { date, session: null, sets: [] };
  $("logDate").value = date;
  $("logWeekday").textContent = new Intl.DateTimeFormat(getLang() === "zh" ? "zh-CN" : "en", { weekday: "long" }).format(parseISO(date));
  setHash(date);
  showError("");
  const ses = await sb.from("exercise_sessions").select("*").eq("entry_date", date).maybeSingle();
  if (seq !== loadSeq) return;
  if (ses.error) return failLoad(ses.error.message);
  let sets = [];
  if (ses.data) {
    const r = await sb.from("exercise_sets").select("*").eq("session_id", ses.data.id).order("position");
    if (seq !== loadSeq) return;
    if (r.error) return failLoad(r.error.message);
    sets = r.data;
  }
  cur = { date, session: ses.data, sets };
  render();
  fillLastTimes(seq);
};

const failLoad = (msg) => {
  cur.sets = [];
  render();
  showError(t("loadDayFail", { msg }));
};

// Rendering ------------------------------------------------------------------------------------
const lastEls = new Map(); // exerciseId -> the "Last time" paragraphs on screen

const render = () => {
  const byId = catalogById();
  const frag = document.createDocumentFragment();
  lastEls.clear();
  const counts = new Map();
  let group = null;
  for (const s of cur.sets) {
    if (!group || group.exId !== s.exercise_id) {
      group = { exId: s.exercise_id, el: document.createElement("div") };
      group.el.className = "log-group";
      const head = document.createElement("div");
      head.className = "log-head";
      const name = document.createElement("span");
      name.className = "log-name";
      name.textContent = exName(byId.get(s.exercise_id));
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = t("addSet");
      const exId = s.exercise_id;
      add.addEventListener("click", () => openSetForm({ mode: "add", exId, prefill: true }));
      head.append(name, add);
      const last = document.createElement("p");
      last.className = "log-last";
      if (!lastEls.has(exId)) lastEls.set(exId, []);
      lastEls.get(exId).push(last);
      group.el.append(head, last);
      frag.append(group.el);
    }
    const n = (counts.get(s.exercise_id) ?? 0) + 1;
    counts.set(s.exercise_id, n);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "log-set" + (s.is_warmup ? " warm" : "");
    const num = document.createElement("span");
    num.className = "n";
    num.textContent = t("setN", { n });
    const txt = document.createElement("span");
    txt.textContent = setText(s);
    b.append(num, txt);
    b.addEventListener("click", () => openSetForm({ mode: "edit", set: s }));
    group.el.append(b);
  }
  $("logList").replaceChildren(frag);
  $("logEmpty").hidden = cur.sets.length > 0;

  $("sessionBox").hidden = !cur.session;
  if (cur.session) {
    $("sBody").value = cur.session.bodyweight == null ? "" : String(toDisplayWeight(cur.session.bodyweight));
    $("sNotes").value = cur.session.notes ?? "";
  }
  $("sBody").setAttribute("aria-label", `${t("bodyweight")} (${units.weight})`);
};

const fillLastTimes = async (seq) => {
  await Promise.all([...lastEls.keys()].map(async (exId) => {
    const sets = await lastSession(exId, cur.date);
    if (seq !== loadSeq || !sets.length) return;
    for (const el of lastEls.get(exId) ?? []) el.textContent = t("lastTime", { text: summarize(sets) });
  }));
};

// Session fields (body weight, notes) --------------------------------------------------------------
const saveSession = async () => {
  if (!cur.session) return;
  const raw = parseNum($("sBody").value);
  if (Number.isNaN(raw)) return showError(t("badNumber", { metric: t("bodyweight") }));
  showError("");
  const payload = { bodyweight: raw == null ? null : fromDisplayWeight(raw), notes: $("sNotes").value.trim() || null };
  const { data, error } = await sb.from("exercise_sessions").update(payload).eq("id", cur.session.id).select().single();
  if (error) return showError(t("logFail", { msg: error.message }));
  cur.session = data;
};
$("sBody").addEventListener("change", saveSession);
$("sNotes").addEventListener("change", saveSession);

// Picker ---------------------------------------------------------------------------------------
const renderPicker = async () => {
  const q = $("pickSearch").value.trim().toLowerCase();
  const recent = await loadRecents();
  const rank = new Map(recent.map((id, i) => [id, i]));
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
    b.addEventListener("click", () => { close("pickOverlay"); openSetForm({ mode: "add", exId: e.id }); });
    frag.append(b);
  }
  $("pickList").replaceChildren(frag);
  $("pickEmpty").hidden = items.length > 0;
};
$("logAdd").addEventListener("click", async () => {
  $("pickSearch").value = "";
  await renderPicker();
  open("pickOverlay");
});
$("pickSearch").addEventListener("input", renderPicker);
$("pickNew").addEventListener("click", () => {
  close("pickOverlay");
  openCreate((row) => openSetForm({ mode: "add", exId: row.id }));
});

// Set form (add and edit) ----------------------------------------------------------------------
const fields = {}; // metric -> { wrap, input, toggle }
let sf = null; // { mode, ex, date, set, copy }
let armTimer = null;
const resetArm = () => { clearTimeout(armTimer); armTimer = null; $("setDelete").textContent = t("delete"); };

const labelFor = (m) => {
  if (m === "weight") return `${metricName(m)} (${units.weight})`;
  if (m === "distance") return `${metricName(m)} (${units.distance})`;
  if (m === "duration") return `${metricName(m)} (m:ss)`;
  return metricName(m);
};

const buildFields = (ex) => {
  const frag = document.createDocumentFragment();
  for (const m of METRICS) {
    const required = ex.required_metrics.includes(m);
    if (!required && !ex.optional_metrics.includes(m)) continue;
    const wrap = document.createElement("label");
    wrap.className = "field";
    const span = document.createElement("span");
    span.textContent = labelFor(m);
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.inputMode = m === "reps" ? "numeric" : m === "duration" ? "text" : "decimal";
    wrap.append(span, input);
    fields[m] = { wrap, input, required };
    if (!required) {
      wrap.hidden = true;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "neutral-btn";
      toggle.textContent = t("addMetric", { metric: metricName(m) });
      toggle.addEventListener("click", () => { wrap.hidden = false; toggle.hidden = true; input.focus(); });
      fields[m].toggle = toggle;
      frag.append(toggle);
    }
    frag.append(wrap);
  }
  $("setFields").replaceChildren(frag);
};

const reveal = (m) => { const f = fields[m]; if (f?.toggle) { f.wrap.hidden = false; f.toggle.hidden = true; } };

// Fill the form from a stored set.
const fillFrom = (s) => {
  const vals = {
    reps: s.reps == null ? "" : String(s.reps),
    weight: s.weight == null ? "" : String(toDisplayWeight(s.weight)),
    duration: s.duration_sec == null ? "" : fmtDuration(s.duration_sec),
    distance: s.distance_m == null ? "" : String(toDisplayDistance(s.distance_m)),
  };
  for (const m of Object.keys(fields)) {
    fields[m].input.value = vals[m];
    if (vals[m] !== "") reveal(m);
  }
  $("setSide").value = s.side ?? "";
  $("setWarm").checked = !!s.is_warmup;
};

const todaysLastSet = (exId) => cur.sets.filter((s) => s.exercise_id === exId).at(-1) ?? null;

async function openSetForm({ mode, exId, set, prefill }) {
  const ex = catalogById().get(mode === "edit" ? set.exercise_id : exId);
  if (!ex) return showError(t("missingExercise"));
  sf = { mode, ex, date: cur.date, set: set ?? null, copy: null };
  for (const k of Object.keys(fields)) delete fields[k];
  buildFields(ex);
  resetArm();
  $("setError").textContent = "";
  $("setTitle").textContent = t(mode === "edit" ? "editSetTitle" : "addSetTitle");
  $("setInfo").textContent = exName(ex);
  $("setSideWrap").hidden = !ex.unilateral;
  $("setSide").replaceChildren(new Option(t("sideNone"), ""), new Option(t("sideLeft"), "left"), new Option(t("sideRight"), "right"));
  $("setSide").value = "";
  $("setWarm").checked = false;
  $("setDelete").hidden = mode !== "edit";
  $("setCopy").hidden = true;
  $("setSave").textContent = t(mode === "edit" ? "save" : "saveSet");
  if (mode === "edit") fillFrom(set);

  // "Copy last set": the previous set of this exercise today, else from its last session.
  if (mode === "add") {
    sf.copy = todaysLastSet(ex.id);
    if (!sf.copy) { const prev = await lastSession(ex.id, sf.date); sf.copy = prev.at(-1) ?? null; }
    $("setCopy").hidden = !sf.copy;
    if (prefill && sf.copy) fillFrom(sf.copy);
  }
  open("setOverlay");
}

$("setCopy").addEventListener("click", () => { if (sf?.copy) fillFrom(sf.copy); });

// Reads the form. Returns { values } or { error }.
const readForm = () => {
  const v = { reps: null, weight: null, duration_sec: null, distance_m: null };
  for (const [m, f] of Object.entries(fields)) {
    const raw = f.input.value.trim();
    const shown = !f.wrap.hidden;
    if (!shown || raw === "") {
      if (f.required) return { error: t("needValue", { metric: metricName(m) }) };
      continue;
    }
    const bad = { error: t("badNumber", { metric: metricName(m) }) };
    if (m === "reps") {
      if (!/^\d+$/.test(raw)) return bad;
      v.reps = Number(raw);
    } else if (m === "duration") {
      const s = parseDuration(raw);
      if (s == null) return bad;
      v.duration_sec = s;
    } else {
      const n = parseNum(raw);
      if (n == null || Number.isNaN(n)) return bad;
      if (m === "weight") v.weight = fromDisplayWeight(n); else v.distance_m = fromDisplayDistance(n);
    }
  }
  v.side = sf.ex.unilateral && $("setSide").value ? $("setSide").value : null;
  v.is_warmup = $("setWarm").checked;
  return { values: v };
};

const refreshSession = async () => {
  const { data } = await sb.from("exercise_sessions").select("*").eq("entry_date", cur.date).maybeSingle();
  cur.session = data ?? null;
};

$("setForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!sf) return;
  $("setError").textContent = "";
  const { values, error } = readForm();
  if (error) { $("setError").textContent = error; return; }
  $("setSave").disabled = true;
  let res;
  if (sf.mode === "add") {
    const args = {
      p_entry_date: sf.date, p_exercise_id: sf.ex.id, p_reps: values.reps, p_weight: values.weight,
      p_duration_sec: values.duration_sec, p_distance_m: values.distance_m, p_side: values.side, p_is_warmup: values.is_warmup,
    };
    res = await sb.rpc("exercise_add_set", args);
    if (res.error?.code === "23505") res = await sb.rpc("exercise_add_set", args); // position collision: retry once
  } else {
    res = await sb.from("exercise_sets").update(values).eq("id", sf.set.id).select().single();
  }
  $("setSave").disabled = false;
  if (res.error) { $("setError").textContent = t("logFail", { msg: res.error.message }); return; }

  if (sf.mode === "add") cur.sets.push(res.data);
  else cur.sets = cur.sets.map((s) => (s.id === res.data.id ? res.data : s));
  if (!cur.session) await refreshSession();
  bumpCaches();
  close("setOverlay");
  render();
  fillLastTimes(loadSeq);
  changed();
});

// Two-tap delete: the first tap arms it, the second within 4 seconds confirms.
$("setDelete").addEventListener("click", async () => {
  if (!sf || sf.mode !== "edit") return;
  if (!armTimer) {
    $("setDelete").textContent = t("deleteArm");
    armTimer = setTimeout(resetArm, 4000);
    return;
  }
  resetArm();
  $("setDelete").disabled = true;
  const { error } = await sb.from("exercise_sets").delete().eq("id", sf.set.id);
  if (error) { $("setDelete").disabled = false; $("setError").textContent = t("logFail", { msg: error.message }); return; }
  cur.sets = cur.sets.filter((s) => s.id !== sf.set.id);
  if (!cur.sets.length && cur.session) { // an empty day should not linger in History
    const r = await sb.from("exercise_sessions").delete().eq("id", cur.session.id);
    if (!r.error) cur.session = null;
  }
  $("setDelete").disabled = false;
  bumpCaches();
  close("setOverlay");
  render();
  changed();
});

// Date bar and wiring --------------------------------------------------------------------------
$("logPrev").addEventListener("click", () => load(shiftDate(cur.date, -1)));
$("logNext").addEventListener("click", () => load(shiftDate(cur.date, 1)));
$("logDate").addEventListener("change", () => { if ($("logDate").value) load($("logDate").value); });
window.addEventListener("hashchange", () => { const d = hashDate(); if (d && d !== cur.date) load(d); });

document.addEventListener("exercise:lang", () => {
  $("logWeekday").textContent = new Intl.DateTimeFormat(getLang() === "zh" ? "zh-CN" : "en", { weekday: "long" }).format(parseISO(cur.date));
  render();
  fillLastTimes(loadSeq);
  if ($("setOverlay").classList.contains("open") && sf) {
    $("setTitle").textContent = t(sf.mode === "edit" ? "editSetTitle" : "addSetTitle");
    $("setInfo").textContent = exName(sf.ex);
    for (const [m, f] of Object.entries(fields)) {
      f.wrap.firstChild.textContent = labelFor(m);
      if (f.toggle) f.toggle.textContent = t("addMetric", { metric: metricName(m) });
    }
    const side = $("setSide").value;
    $("setSide").replaceChildren(new Option(t("sideNone"), ""), new Option(t("sideLeft"), "left"), new Option(t("sideRight"), "right"));
    $("setSide").value = side;
    resetArm();
  }
  if ($("pickOverlay").classList.contains("open")) renderPicker();
});
document.addEventListener("exercise:catalog", () => { render(); fillLastTimes(loadSeq); });

load(hashDate() ?? today());
