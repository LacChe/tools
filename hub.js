// The hub: the apps you can open, and the settings (language, sign out) that apply to all of them.
import { sb, requireAuth, signOut } from "./auth.js";
import { LANGS, getLang, nameOf, applyStatic, setLang } from "./hub-i18n.js";

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
$("sLang").addEventListener("change", () => { setLang($("sLang").value); renderTiles(); });
$("openSettings").addEventListener("click", () => $("settingsOverlay").classList.add("open"));
$("signout").addEventListener("click", signOut);
for (const el of [$("settingsOverlay")]) {
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-close]")) el.classList.remove("open"); });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("settingsOverlay").classList.remove("open"); });
