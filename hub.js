// The hub: the apps you can open, and the settings (language, sign out) that apply to all of them.
import { sb, requireAuth, signOut } from "./auth.js";
import { LANGS, getLang, t, nameOf, applyStatic, setLang } from "./hub-i18n.js";
import { getState, enable, disable, sendTest } from "./push.js";

await requireAuth();
applyStatic();
document.getElementById("app").hidden = false;

const $ = (id) => document.getElementById(id);
const tools = await (await fetch("tools.json")).json();
const { data: rows, error } = await sb.from("hub_app_access").select("app_id");
const allowed = error ? null : new Set(rows.map((r) => r.app_id));
const visible = allowed ? tools.filter((t) => allowed.has(t.id)) : tools;

const labels = new Map(); // tool -> its label element, so a language change can rename the tiles
const items = await Promise.all(visible.map(async (tool) => {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "tile";
  a.href = tool.path;
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.setAttribute("aria-hidden", "true");
  try {
    const r = await fetch(tool.icon);
    if (!r.ok) throw new Error();
    icon.innerHTML = await r.text();
  } catch {
    const img = document.createElement("img");
    img.src = tool.icon; img.alt = "";
    icon.append(img);
  }
  const label = document.createElement("span");
  labels.set(tool, label);
  a.append(icon, label);
  li.append(a);
  return li;
}));
$("grid").append(...items);
const renderTiles = () => { for (const [tool, el] of labels) el.textContent = nameOf(tool); };
renderTiles();

// Settings ---------------------------------------------------------------------------------------
for (const [code, name] of Object.entries(LANGS)) $("sLang").append(new Option(name, code));
$("sLang").value = getLang();
$("sLang").addEventListener("change", () => { setLang($("sLang").value); renderTiles(); renderPush(); });
// Notifications (push.js). The section stays hidden until push is set up; the buttons only appear when they can work.
const PUSH_TEXT = {
  on: "pushStateOn", off: "pushStateOff", "needs-install": "pushNeedsInstall", unsupported: "pushUnsupported", denied: "pushDenied",
};
let pushState = "unconfigured";
async function renderPush() {
  pushState = await getState();
  const show = pushState !== "unconfigured";
  for (const el of document.querySelectorAll("[data-push]")) el.hidden = !show;
  $("pushStatus").textContent = show ? t(PUSH_TEXT[pushState]) : "";
  $("pushToggle").hidden = !(pushState === "on" || pushState === "off");
  $("pushToggle").textContent = t(pushState === "on" ? "pushDisable" : "pushEnable");
  $("pushTest").hidden = pushState !== "on";
}
// Runs a push action with the buttons locked, shows a failure in the section, then redraws it.
async function runPush(action) {
  const buttons = [$("pushToggle"), $("pushTest")];
  $("pushOk").textContent = "";
  $("pushError").textContent = "";
  buttons.forEach((b) => { b.disabled = true; });
  try { await action(); } catch (e) { $("pushError").textContent = t("pushFail", { msg: e.message }); }
  buttons.forEach((b) => { b.disabled = false; });
  await renderPush();
}
$("pushToggle").addEventListener("click", () => runPush(() => (pushState === "on" ? disable() : enable())));
$("pushTest").addEventListener("click", () => runPush(async () => {
  const { sent } = await sendTest(t("title"), t("pushTestBody"));
  $("pushOk").textContent = t(sent > 0 ? "pushTestSent" : "pushTestNone");
}));
renderPush();

$("openSettings").addEventListener("click", () => $("settingsOverlay").classList.add("open"));
$("signout").addEventListener("click", signOut);
for (const el of [$("settingsOverlay")]) {
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-close]")) el.classList.remove("open"); });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("settingsOverlay").classList.remove("open"); });
