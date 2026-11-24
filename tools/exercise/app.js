import { sb, requireAuth } from "../../auth.js";
import { t, applyStatic } from "./i18n.js";
import { state } from "./state.js";
import { units, saveUnits } from "./common.js";

applyStatic();
const session = await requireAuth();
const $ = (id) => document.getElementById(id);
const status = $("status");

const fail = (msg) => {
  status.textContent = t("loadFail", { msg });
  const retry = document.createElement("button"); // an expired sign-in or a dropped connection usually clears on reload
  retry.type = "button";
  retry.className = "neutral-btn";
  retry.textContent = t("retry");
  retry.addEventListener("click", () => location.reload());
  status.append(" ", retry);
  throw new Error("load failed");
};

// Shared state: later steps import these from here.
const [cat, prof, cata, rout] = await Promise.all([
  sb.from("exercise_categories").select("*").order("sort_order"),
  sb.from("hub_profiles").select("display_name").eq("user_id", session.user.id).maybeSingle(),
  sb.from("exercise_catalog").select("*, creator:hub_profiles!created_by(display_name)"),
  sb.from("exercise_routines").select("*, creator:hub_profiles!created_by(display_name)"),
]);
if (cat.error) fail(cat.error.message);
if (cata.error) fail(cata.error.message);
if (rout.error) fail(rout.error.message);
if (!cat.data.length) { // RLS returns nothing without access to this app
  status.textContent = t("noAccess");
  throw new Error("no access");
}
state.userId = session.user.id;
state.categories = cat.data;
state.profile = prof.error ? null : prof.data; // tolerate a missing profile row
state.catalog = cata.data;
state.routines = rout.data;

status.remove();
$("app").hidden = false;

await import("./library.js"); // these register their listeners; they need state to be filled first
await import("./routines.js");
await import("./log.js");
await import("./history.js");
await import("./progress.js");

// Tabs: all views live in this page; the current one is kept in the URL hash.
const VIEWS = ["log", "history", "progress", "library"];
const showView = (view) => {
  for (const b of document.querySelectorAll(".view-toggle button")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  for (const s of document.querySelectorAll("[data-view-section]")) s.hidden = s.dataset.viewSection !== view;
  const same = location.hash.slice(1).split("?")[0] === view; // keep "#log?date=..." when already on that view
  try { history.replaceState(null, "", same ? location.hash : `#${view}`); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent("exercise:view", { detail: { view } }));
};
const viewFromHash = () => {
  const v = location.hash.slice(1).split("?")[0];
  return VIEWS.includes(v) ? v : "log";
};
for (const b of document.querySelectorAll(".view-toggle button")) b.addEventListener("click", () => showView(b.dataset.view));
window.addEventListener("hashchange", () => showView(viewFromHash()));
showView(viewFromHash());

// Overlays: Escape and the backdrop close only the top-most one, so a picker over a form leaves the form open.
const closeOverlay = (o) => o.classList.remove("open");
document.querySelectorAll(".overlay").forEach((o) => {
  o.addEventListener("click", (e) => { if (e.target === o) closeOverlay(o); });
  o.querySelector("[data-close]").addEventListener("click", () => closeOverlay(o));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".overlay.open").item(document.querySelectorAll(".overlay.open").length - 1)?.classList.remove("open");
});

// Settings (the language is chosen in the hub; units and display name live here)
$("openSettings").addEventListener("click", () => {
  $("sWeight").value = units.weight;
  $("sDist").value = units.distance;
  $("sName").value = state.profile?.display_name ?? "";
  $("sError").textContent = "";
  $("settingsOverlay").classList.add("open");
});

// Units are a per-device display choice: data stays in kg and meters. Other panels close so no form shows stale units.
const onUnits = () => {
  units.weight = $("sWeight").value;
  units.distance = $("sDist").value;
  saveUnits();
  document.querySelectorAll(".overlay.open").forEach((o) => { if (o.id !== "settingsOverlay") closeOverlay(o); });
  document.dispatchEvent(new Event("exercise:units"));
};
$("sWeight").addEventListener("change", onUnits);
$("sDist").addEventListener("change", onUnits);

// Display name: shown as "created by" on shared exercises and routines.
$("sName").addEventListener("change", async () => {
  const name = $("sName").value.trim();
  $("sError").textContent = "";
  if (!name || name.length > 40) {
    $("sName").value = state.profile?.display_name ?? "";
    $("sError").textContent = t("badName");
    return;
  }
  const { data, error } = await sb.from("hub_profiles").update({ display_name: name }).eq("user_id", state.userId).select("display_name").maybeSingle();
  if (error) { $("sError").textContent = t("saveFail", { msg: error.message }); return; }
  if (!data) { $("sError").textContent = t("profileMissing"); return; }
  state.profile = data;
  for (const row of [...state.catalog, ...state.routines]) if (row.created_by === state.userId) row.creator = { display_name: data.display_name };
  document.dispatchEvent(new Event("exercise:catalog"));
  document.dispatchEvent(new Event("exercise:routines"));
});
