import { sb, requireAuth } from "../../auth.js";
import { today, fmt, money, catColor } from "./common.js";
import { t, getLang, setLang, applyStatic, catName, curName, LANGS } from "./i18n.js";

applyStatic();
await requireAuth();
const $ = (id) => document.getElementById(id);
const status = $("status");

const fail = (msg) => {
  status.textContent = t("loadFail", { msg });
  throw new Error("load failed");
};

// Paging: newest first, PAGE rows at a time. `before` is the strict date bound for the next fetch.
const PAGE = 80;
let before = null;
let hasMore = true;
let loading = false;
const fetchEntries = (bound) => {
  let q = sb.from("expenses_entries").select("*")
    .order("entry_date", { ascending: false }).order("id", { ascending: false }).limit(PAGE);
  if (bound) q = q.lt("entry_date", bound);
  return q;
};
// Keeps only whole days: when a page is full, its last day may be cut off, so drop it and fetch it next time.
const take = (data) => {
  if (data.length < PAGE) { hasMore = false; return data; }
  const lastDate = data[data.length - 1].entry_date;
  const kept = data.filter((r) => r.entry_date > lastDate);
  if (!kept.length) { before = lastDate; return data; } // one day filled a whole page (not expected)
  before = kept[kept.length - 1].entry_date;
  return kept;
};

const [cat, cur, set, ent] = await Promise.all([
  sb.from("expenses_categories").select("*").order("sort_order"),
  sb.from("expenses_currencies").select("*").order("sort_order"),
  sb.from("expenses_settings").select("default_currency").maybeSingle(),
  fetchEntries(null),
]);
for (const r of [cat, cur, set, ent]) if (r.error) fail(r.error.message);
if (!cat.data.length) {
  status.textContent = t("noAccess");
  throw new Error("no access");
}

const categories = cat.data;
const currencies = cur.data;
const catBySlug = new Map(categories.map((c) => [c.slug, c]));
const lab = (slug) => (catBySlug.has(slug) ? catName(catBySlug.get(slug)) : slug);
const catOrder = new Map(categories.map((c) => [c.slug, c.sort_order]));
let entries = take(ent.data);
let defaultCurrency =
  set.data && currencies.some((c) => c.code === set.data.default_currency)
    ? set.data.default_currency
    : currencies[0]?.code;

status.remove();
$("app").hidden = false;

// Records / Reports switch: both views are in this page, so toggling is instant (no navigation).
const showView = (view) => {
  const reports = view === "reports";
  $("recordsView").hidden = reports;
  $("reportsView").hidden = !reports;
  $("tabRecords").setAttribute("aria-pressed", String(!reports));
  $("tabReports").setAttribute("aria-pressed", String(reports));
  if (reports) document.dispatchEvent(new Event("expenses:view")); // Reports can only measure itself once visible
  try { history.replaceState(null, "", reports ? "#reports" : location.pathname + location.search); } catch { /* ignore */ }
};
$("tabRecords").addEventListener("click", () => showView("records"));
$("tabReports").addEventListener("click", () => showView("reports"));
showView(location.hash === "#reports" ? "reports" : "records");
const changed = () => document.dispatchEvent(new Event("expenses:changed"));

const fill = (select, items, value, label) => {
  for (const it of items) {
    const o = document.createElement("option");
    o.value = it[value];
    o.textContent = label(it);
    select.append(o);
  }
};
// (Re)builds the option lists in the current language, keeping what is selected.
const fillSelects = () => {
  const keep = ["fCategory", "fCurrency", "sCurrency"].map((id) => $(id).value);
  const placeholder = $("fCategory").querySelector("option[disabled]");
  $("fCategory").replaceChildren(placeholder);
  $("fCurrency").replaceChildren();
  $("sCurrency").replaceChildren();
  fill($("fCategory"), categories, "slug", catName);
  fill($("fCurrency"), currencies, "code", (c) => c.code);
  fill($("sCurrency"), currencies, "code", (c) => `${c.code} – ${curName(c)}`);
  ["fCategory", "fCurrency", "sCurrency"].forEach((id, i) => { $(id).value = keep[i]; });
};
fillSelects();
for (const [code, name] of Object.entries(LANGS)) {
  const o = document.createElement("option");
  o.value = code;
  o.textContent = name;
  $("sLang").append(o);
}
$("sLang").value = getLang();
$("fDate").value = today();
$("fCurrency").value = defaultCurrency;

const parseAmount = (raw) => {
  const v = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(v)) return { error: t("badAmount") };
  if (Math.abs(v) >= 1e12) return { error: t("bigAmount") };
  return { value: Math.round(v * 100) / 100 };
};

// List ------------------------------------------------------------------
const render = () => {
  const list = $("list");
  list.replaceChildren();
  if (!entries.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = t("noEntries");
    list.append(p);
    return;
  }
  const days = new Map();
  for (const e of entries) {
    if (!days.has(e.entry_date)) days.set(e.entry_date, []);
    days.get(e.entry_date).push(e);
  }
  const dates = [...days.keys()].sort().reverse();
  for (const date of dates) {
    const [y, m, d] = date.split("-").map(Number);
    const section = document.createElement("section");
    section.className = "day";
    const rows = days.get(date).sort((a, b) => (catOrder.get(a.category) ?? 0) - (catOrder.get(b.category) ?? 0));

    // Per currency: net amount per category (ratios across currencies would be meaningless).
    const byCur = new Map();
    for (const e of rows) {
      if (!byCur.has(e.currency)) byCur.set(e.currency, new Map());
      const perCat = byCur.get(e.currency);
      perCat.set(e.category, (perCat.get(e.category) ?? 0) + Number(e.amount));
    }

    const h = document.createElement("h2");
    h.className = "day-header";
    const label = document.createElement("span");
    label.className = "day-label";
    label.textContent = `${date} · ${t("weekdays")[new Date(y, m - 1, d).getDay()]}`;
    const sums = document.createElement("span");
    sums.className = "day-sums";
    for (const [currency, perCat] of byCur) {
      const net = [...perCat.values()].reduce((a, v) => a + v, 0);
      const segs = [...perCat].filter(([, v]) => Math.abs(v) >= 0.005);
      const absSum = segs.reduce((a, [, v]) => a + Math.abs(v), 0);
      const sum = document.createElement("span");
      sum.className = "day-sum";
      if (absSum > 0) {
        const bar = document.createElement("span");
        bar.className = "day-bar";
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", segs.map(([c, v]) => `${lab(c)} ${money(v, currency)}`).join(", "));
        for (const [c, v] of segs) {
          const seg = document.createElement("span");
          seg.className = v < 0 ? "day-seg neg" : "day-seg";
          seg.style.flexGrow = String((Math.abs(v) / absSum) * 100);
          seg.style.setProperty("--cat", catColor(c));
          seg.title = `${lab(c)}: ${money(v, currency)}`;
          bar.append(seg);
        }
        sum.append(bar);
      }
      const amt = document.createElement("span");
      amt.className = "day-amt";
      amt.textContent = money(net, currency);
      sum.append(amt);
      sums.append(sum);
    }
    h.append(label, sums);
    section.append(h);
    for (const e of rows) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "row";
      b.style.setProperty("--cat", catColor(e.category));
      const l = document.createElement("span");
      l.textContent = lab(e.category);
      const r = document.createElement("span");
      r.className = "amt";
      r.textContent = fmt(e.amount);
      const c = document.createElement("span");
      c.className = "cur";
      c.textContent = e.currency;
      r.append(c);
      b.append(l, r);
      b.addEventListener("click", () => openEdit(e));
      section.append(b);
    }
    list.append(section);
  }
};

// Footer under the list: loading / retry / end-of-list message, and the trigger for loading more.
const listEnd = $("listEnd");
const updateEnd = () => {
  listEnd.classList.remove("retry");
  listEnd.onclick = null;
  if (!entries.length) listEnd.textContent = "";
  else if (hasMore) listEnd.textContent = loading ? t("loading") : "";
  else listEnd.textContent = t("end");
};
const io = new IntersectionObserver((hits) => {
  if (hits.some((h) => h.isIntersecting)) loadMore();
}, { rootMargin: "400px 0px" });
// Re-observing makes the observer report again, so a short list keeps loading until it fills the screen.
const recheck = () => { io.unobserve(listEnd); io.observe(listEnd); };

const loadMore = async () => {
  if (loading || !hasMore) return;
  loading = true;
  updateEnd();
  const { data, error } = await fetchEntries(before);
  loading = false;
  if (error) {
    listEnd.textContent = t("moreFail");
    listEnd.classList.add("retry");
    listEnd.onclick = loadMore;
    return;
  }
  const seen = new Set(entries.map((e) => e.id));
  entries = entries.concat(take(data).filter((r) => !seen.has(r.id)));
  render();
  updateEnd();
  recheck();
};

// Start over from the newest page (fallback when a save returns something unexpected).
const resetAndLoad = async () => {
  before = null;
  hasMore = true;
  const { data, error } = await fetchEntries(null);
  if (error) { $("formError").textContent = error.message; return; }
  entries = take(data);
  render();
  updateEnd();
  recheck();
};

// Local updates after a save: no refetch, so already-loaded older pages stay put.
const applyUpsert = (row) => {
  if (!row || row.id == null) return resetAndLoad();
  const i = entries.findIndex((e) => e.id === row.id);
  if (i >= 0) entries[i] = row;
  else if (!hasMore || before === null || row.entry_date >= before) entries.push(row);
  // else: older than what is loaded; it shows up when the user scrolls to it.
  render();
  updateEnd();
};

render();
updateEnd();
io.observe(listEnd);

// Overlays --------------------------------------------------------------
const open = (o) => o.classList.add("open");
const closeAll = () => document.querySelectorAll(".overlay.open").forEach((o) => o.classList.remove("open"));
document.querySelectorAll(".overlay").forEach((o) => {
  o.addEventListener("click", (e) => { if (e.target === o) closeAll(); });
  o.querySelector("[data-close]").addEventListener("click", closeAll);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

// Add -------------------------------------------------------------------
let okTimer;
$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("formError");
  const ok = $("formOk");
  err.textContent = "";
  ok.textContent = "";
  const category = $("fCategory").value;
  if (!category) { err.textContent = t("chooseType"); return; }
  const a = parseAmount($("fAmount").value);
  if (a.error) { err.textContent = a.error; return; }
  const currency = $("fCurrency").value;
  const btn = $("addBtn");
  btn.disabled = true;
  const { data, error } = await sb.rpc("expenses_add_entry", {
    p_entry_date: $("fDate").value, p_category: category, p_currency: currency, p_amount: a.value,
  });
  btn.disabled = false;
  if (error) { err.textContent = error.message; return; }
  $("fAmount").value = "";
  ok.textContent = t("added", { amt: fmt(a.value), cur: currency, cat: lab(category) });
  clearTimeout(okTimer);
  okTimer = setTimeout(() => { ok.textContent = ""; }, 3000);
  await applyUpsert(Array.isArray(data) ? data[0] : data);
  changed();
});

// Edit ------------------------------------------------------------------
let editing = null;
let delTimer;
const resetDelete = () => {
  clearTimeout(delTimer);
  $("deleteBtn").textContent = t("delete");
  $("deleteBtn").dataset.armed = "";
};
const openEdit = (e) => {
  editing = e;
  resetDelete();
  $("editError").textContent = "";
  $("editInfo").textContent = `${e.entry_date} · ${lab(e.category)} · ${e.currency}`;
  $("eAmount").value = fmt(e.amount);
  open($("editOverlay"));
};
$("editForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const err = $("editError");
  err.textContent = "";
  const a = parseAmount($("eAmount").value);
  if (a.error) { err.textContent = a.error; return; }
  $("saveBtn").disabled = true;
  const { error } = await sb.from("expenses_entries").update({ amount: a.value }).eq("id", editing.id);
  $("saveBtn").disabled = false;
  if (error) { err.textContent = error.message; return; }
  closeAll();
  editing.amount = a.value;
  render();
  updateEnd();
  changed();
});
$("deleteBtn").addEventListener("click", async () => {
  const btn = $("deleteBtn");
  if (!btn.dataset.armed) {
    btn.dataset.armed = "1";
    btn.textContent = t("deleteArm");
    delTimer = setTimeout(resetDelete, 4000);
    return;
  }
  resetDelete();
  const { error } = await sb.from("expenses_entries").delete().eq("id", editing.id);
  if (error) { $("editError").textContent = error.message; return; }
  closeAll();
  entries = entries.filter((x) => x.id !== editing.id);
  render();
  updateEnd();
  changed();
});

// Settings --------------------------------------------------------------
$("openSettings").addEventListener("click", () => {
  $("settingsError").textContent = "";
  $("sCurrency").value = defaultCurrency;
  open($("settingsOverlay"));
});
$("settingsForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const next = $("sCurrency").value;
  $("settingsSave").disabled = true;
  const { error } = await sb.from("expenses_settings").upsert({ default_currency: next }, { onConflict: "user_id" });
  $("settingsSave").disabled = false;
  if (error) { $("settingsError").textContent = error.message; return; }
  if ($("fCurrency").value === defaultCurrency) $("fCurrency").value = next;
  defaultCurrency = next;
  closeAll();
  const ok = $("formOk");
  ok.textContent = t("defaultSet", { cur: next });
  clearTimeout(okTimer);
  okTimer = setTimeout(() => { ok.textContent = ""; }, 3000);
});

// Language ----------------------------------------------------------------
$("sLang").addEventListener("change", () => setLang($("sLang").value));
document.addEventListener("expenses:lang", () => {
  fillSelects();
  render();
  updateEnd();
  resetDelete();
  if (editing && $("editOverlay").classList.contains("open")) $("editInfo").textContent = `${editing.entry_date} · ${lab(editing.category)} · ${editing.currency}`;
  $("formOk").textContent = "";
});
