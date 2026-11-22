import { sb, requireAuth } from "../../auth.js";

await requireAuth();
const $ = (id) => document.getElementById(id);
const status = $("status");

// Local-date helpers (never toISOString: it returns the UTC date).
const pad = (n) => String(n).padStart(2, "0");
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => localISO(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); };

const fail = (msg) => {
  status.textContent = "Could not load data: " + msg;
  throw new Error("load failed");
};

const [cat, cur, set, ent] = await Promise.all([
  sb.from("expenses_categories").select("*").order("sort_order"),
  sb.from("expenses_currencies").select("*").order("sort_order"),
  sb.from("expenses_settings").select("default_currency").maybeSingle(),
  sb.from("expenses_entries").select("*").gte("entry_date", daysAgo(30)).order("entry_date", { ascending: false }),
]);
for (const r of [cat, cur, set, ent]) if (r.error) fail(r.error.message);
if (!cat.data.length) {
  status.textContent = "No access to this app.";
  throw new Error("no access");
}

const categories = cat.data;
const currencies = cur.data;
const catLabel = new Map(categories.map((c) => [c.slug, c.label_en]));
const catOrder = new Map(categories.map((c) => [c.slug, c.sort_order]));
let entries = ent.data;
let defaultCurrency =
  set.data && currencies.some((c) => c.code === set.data.default_currency)
    ? set.data.default_currency
    : currencies[0]?.code;

status.remove();
$("app").hidden = false;

const fill = (select, items, value, label) => {
  for (const it of items) {
    const o = document.createElement("option");
    o.value = it[value];
    o.textContent = label(it);
    select.append(o);
  }
};
fill($("fCategory"), categories, "slug", (c) => c.label_en);
fill($("fCurrency"), currencies, "code", (c) => c.code);
fill($("sCurrency"), currencies, "code", (c) => `${c.code} – ${c.label_en}`);
$("fDate").value = today();
$("fCurrency").value = defaultCurrency;

const fmt = (n) => String(Number(Number(n).toFixed(2)));

// "¥781", "-$20", "CHF 40": symbol from the browser, so no per-currency data is needed.
const symbols = new Map();
const money = (n, code) => {
  if (!symbols.has(code)) {
    let s = code;
    try {
      s = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
        .formatToParts(0).find((p) => p.type === "currency")?.value ?? code;
    } catch { /* unknown code: show it as-is */ }
    symbols.set(code, /^[A-Za-z]+$/.test(s) ? s + " " : s);
  }
  const v = Number(n);
  return `${v < 0 ? "-" : ""}${symbols.get(code)}${fmt(Math.abs(v))}`;
};

// Category color token for a slug (defined in base.css, themeable); unknown slugs fall back to --muted.
const catColor = (slug) => `var(--cat-${String(slug).replace(/[^a-z0-9_-]/gi, "")}, var(--muted))`;

const parseAmount = (raw) => {
  const v = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(v)) return { error: "Enter a valid amount." };
  if (Math.abs(v) >= 1e12) return { error: "Amount is too large." };
  return { value: Math.round(v * 100) / 100 };
};

// List ------------------------------------------------------------------
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const render = () => {
  const list = $("list");
  list.replaceChildren();
  if (!entries.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No entries in the last 30 days.";
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
    label.textContent = `${date} · ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
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
        bar.setAttribute("aria-label", segs.map(([c, v]) => `${catLabel.get(c) ?? c} ${money(v, currency)}`).join(", "));
        for (const [c, v] of segs) {
          const seg = document.createElement("span");
          seg.className = v < 0 ? "day-seg neg" : "day-seg";
          seg.style.flexGrow = String((Math.abs(v) / absSum) * 100);
          seg.style.setProperty("--cat", catColor(c));
          seg.title = `${catLabel.get(c) ?? c}: ${money(v, currency)}`;
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
      l.textContent = catLabel.get(e.category) ?? e.category;
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

const reload = async () => {
  const { data, error } = await sb.from("expenses_entries").select("*")
    .gte("entry_date", daysAgo(30)).order("entry_date", { ascending: false });
  if (error) { $("formError").textContent = error.message; return; }
  entries = data;
  render();
};
render();

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
  if (!category) { err.textContent = "Choose a type."; return; }
  const a = parseAmount($("fAmount").value);
  if (a.error) { err.textContent = a.error; return; }
  const currency = $("fCurrency").value;
  const btn = $("addBtn");
  btn.disabled = true;
  const { error } = await sb.rpc("expenses_add_entry", {
    p_entry_date: $("fDate").value, p_category: category, p_currency: currency, p_amount: a.value,
  });
  btn.disabled = false;
  if (error) { err.textContent = error.message; return; }
  $("fAmount").value = "";
  ok.textContent = `Added ${fmt(a.value)} ${currency} to ${catLabel.get(category)}`;
  clearTimeout(okTimer);
  okTimer = setTimeout(() => { ok.textContent = ""; }, 3000);
  await reload();
});

// Edit ------------------------------------------------------------------
let editing = null;
let delTimer;
const resetDelete = () => {
  clearTimeout(delTimer);
  $("deleteBtn").textContent = "Delete";
  $("deleteBtn").dataset.armed = "";
};
const openEdit = (e) => {
  editing = e;
  resetDelete();
  $("editError").textContent = "";
  $("editInfo").textContent = `${e.entry_date} · ${catLabel.get(e.category) ?? e.category} · ${e.currency}`;
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
  await reload();
});
$("deleteBtn").addEventListener("click", async () => {
  const btn = $("deleteBtn");
  if (!btn.dataset.armed) {
    btn.dataset.armed = "1";
    btn.textContent = "Tap again to delete";
    delTimer = setTimeout(resetDelete, 4000);
    return;
  }
  resetDelete();
  const { error } = await sb.from("expenses_entries").delete().eq("id", editing.id);
  if (error) { $("editError").textContent = error.message; return; }
  closeAll();
  await reload();
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
  ok.textContent = `Default currency set to ${next}`;
  clearTimeout(okTimer);
  okTimer = setTimeout(() => { ok.textContent = ""; }, 3000);
});
