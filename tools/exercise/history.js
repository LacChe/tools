// History tab: workout days, newest first, loaded as you scroll. Tapping a day opens it in Log.
import { sb } from "../../auth.js";
import { catalogById } from "./state.js";
import { t, nameOf, getLang } from "./i18n.js";
import { parseISO, fmtWeight, fmtDistance, fmtDuration } from "./common.js";

const $ = (id) => document.getElementById(id);
const PAGE = 40;
const COLS = "exercise_id, reps, weight, duration_sec, distance_m, is_warmup, position";

let sessions = []; // { id, entry_date, notes, sets: [...] }, newest first
let hasMore = true;
let loading = false;
let failed = false;
let failMsg = "";
let useEmbed = true; // false when PostgREST can't embed sets through the composite key

// Data -----------------------------------------------------------------------------------------
const fetchPage = async (before) => {
  if (useEmbed) {
    let q = sb.from("exercise_sessions").select(`id, entry_date, notes, exercise_sets(${COLS})`)
      .order("entry_date", { ascending: false }).limit(PAGE);
    if (before) q = q.lt("entry_date", before);
    const r = await q;
    if (!r.error) return r.data.map((s) => ({ id: s.id, entry_date: s.entry_date, notes: s.notes, sets: s.exercise_sets ?? [] }));
    if (!/PGRST20[01]|relationship/i.test(`${r.error.code} ${r.error.message}`)) throw r.error;
    useEmbed = false; // fall through to two plain queries
  }
  let q = sb.from("exercise_sessions").select("id, entry_date, notes").order("entry_date", { ascending: false }).limit(PAGE);
  if (before) q = q.lt("entry_date", before);
  const s = await q;
  if (s.error) throw s.error;
  if (!s.data.length) return [];
  const r = await sb.from("exercise_sets").select(`session_id, ${COLS}`).in("session_id", s.data.map((x) => x.id));
  if (r.error) throw r.error;
  const bySession = new Map(s.data.map((x) => [x.id, []]));
  for (const row of r.data) bySession.get(row.session_id)?.push(row);
  return s.data.map((x) => ({ ...x, sets: bySession.get(x.id) }));
};

const loadMore = async () => {
  if (loading || !hasMore) return;
  loading = true;
  failed = false;
  try {
    const page = await fetchPage(sessions.at(-1)?.entry_date ?? null);
    sessions.push(...page);
    if (page.length < PAGE) hasMore = false;
    render();
  } catch (e) {
    failed = true;
    failMsg = e.message ?? String(e);
  } finally {
    loading = false;
    updateEnd();
  }
  if (!failed) requestAnimationFrame(fillScreen);
};

// Keeps loading while the footer is on screen (the observer alone only fires when it first appears).
const fillScreen = () => {
  if ($("historyView").hidden || !hasMore || loading || failed) return;
  if ($("histEnd").getBoundingClientRect().top < window.innerHeight + 200) loadMore();
};

// Rendering ------------------------------------------------------------------------------------
const summary = (sets) => {
  const work = sets.filter((s) => !s.is_warmup);
  const volume = work.reduce((a, s) => a + (s.reps != null && s.weight != null ? s.reps * s.weight : 0), 0);
  const time = work.reduce((a, s) => a + (s.duration_sec ?? 0), 0);
  const dist = work.reduce((a, s) => a + (s.distance_m ?? 0), 0);
  const parts = [sets.length === 1 ? t("oneSet") : t("setCount", { n: sets.length })];
  if (volume > 0) parts.push(fmtWeight(volume));
  if (time > 0) parts.push(fmtDuration(time));
  if (dist > 0) parts.push(fmtDistance(dist));
  return parts.join(" · ");
};

const render = () => {
  const byId = catalogById();
  const fmt = new Intl.DateTimeFormat(getLang() === "zh" ? "zh-CN" : "en", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const frag = document.createDocumentFragment();
  for (const s of sessions.filter((x) => x.sets.length)) { // a routine started but not yet ticked has no sets
    const sets = s.sets.slice().sort((a, b) => a.position - b.position);
    const names = [];
    for (const x of sets) {
      const e = byId.get(x.exercise_id);
      const n = e ? nameOf(e) || t("unnamed") : t("missingExercise");
      if (!names.includes(n)) names.push(n);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hist-row";
    const d = document.createElement("span");
    d.className = "hist-date";
    d.textContent = fmt.format(parseISO(s.entry_date));
    const n = document.createElement("span");
    n.className = "hist-names";
    n.textContent = names.join(" · ");
    const m = document.createElement("span");
    m.className = "hist-sum";
    m.textContent = summary(sets);
    b.append(d, n, m);
    b.addEventListener("click", () => { location.hash = `#log?date=${s.entry_date}`; });
    frag.append(b);
  }
  $("histList").replaceChildren(frag);
  updateEnd();
};

const updateEnd = () => {
  const end = $("histEnd");
  end.classList.toggle("retry", failed);
  const shown = sessions.filter((x) => x.sets.length).length;
  $("histEmpty").hidden = !(!hasMore && !failed && !shown);
  if (failed) end.textContent = shown ? t("moreFail") : t("historyFail", { msg: failMsg });
  else end.textContent = !hasMore && shown ? t("end") : "";
};
$("histEnd").addEventListener("click", () => { if (failed) loadMore(); });

// Updates from the Log tab: patch the local list instead of refetching.
document.addEventListener("exercise:changed", (ev) => {
  const { date, sets, session } = ev.detail ?? {};
  if (!date) return;
  const i = sessions.findIndex((s) => s.entry_date === date);
  if (!sets.length) {
    if (i >= 0) sessions.splice(i, 1);
  } else if (i >= 0) {
    sessions[i] = { ...sessions[i], id: session?.id ?? sessions[i].id, notes: session ? session.notes : sessions[i].notes, sets };
  } else {
    const oldest = sessions.at(-1)?.entry_date;
    if (!hasMore || (oldest && date >= oldest)) { // inside the loaded range; older days arrive with scrolling
      sessions.push({ id: session?.id ?? null, entry_date: date, notes: session?.notes ?? null, sets });
      sessions.sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
    }
  }
  render();
});

document.addEventListener("exercise:lang", render);
document.addEventListener("exercise:catalog", render);
document.addEventListener("exercise:view", (ev) => { if (ev.detail?.view === "history") fillScreen(); });
new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) fillScreen(); }).observe($("histEnd"));

loadMore();
