import { sb, requireAuth } from "../../auth.js";
import { t, getLang, setLang, applyStatic, LANGS } from "./i18n.js";
import { state } from "./state.js";

applyStatic();
const session = await requireAuth();
const $ = (id) => document.getElementById(id);
const status = $("status");

const fail = (msg) => {
  status.textContent = t("loadFail", { msg });
  throw new Error("load failed");
};

// Shared state: later steps import these from here.
const [cat, prof, cata] = await Promise.all([
  sb.from("exercise_categories").select("*").order("sort_order"),
  sb.from("hub_profiles").select("display_name").eq("user_id", session.user.id).maybeSingle(),
  sb.from("exercise_catalog").select("*, creator:hub_profiles!created_by(display_name)"),
]);
if (cat.error) fail(cat.error.message);
if (cata.error) fail(cata.error.message);
if (!cat.data.length) { // RLS returns nothing without access to this app
  status.textContent = t("noAccess");
  throw new Error("no access");
}
state.userId = session.user.id;
state.categories = cat.data;
state.profile = prof.error ? null : prof.data; // tolerate a missing profile row
state.catalog = cata.data;

status.remove();
$("app").hidden = false;

await import("./library.js"); // these register their listeners; they need state to be filled first
await import("./log.js");

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

// Overlays
const closeAll = () => document.querySelectorAll(".overlay.open").forEach((o) => o.classList.remove("open"));
document.querySelectorAll(".overlay").forEach((o) => {
  o.addEventListener("click", (e) => { if (e.target === o) closeAll(); });
  o.querySelector("[data-close]").addEventListener("click", closeAll);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

// Settings (language only for now; units and display name arrive in step 9)
for (const [code, name] of Object.entries(LANGS)) {
  const o = document.createElement("option");
  o.value = code;
  o.textContent = name;
  $("sLang").append(o);
}
$("sLang").value = getLang();
$("openSettings").addEventListener("click", () => $("settingsOverlay").classList.add("open"));
$("sLang").addEventListener("change", () => setLang($("sLang").value));
