// Boot and wiring only: auth, access check, tabs. No data logic and no DOM beyond the shell.
import { sb, requireAuth } from "../../auth.js";
import { t, applyStatic } from "./i18n.js?v=1";
import { createStore } from "./store.js?v=1";

applyStatic();
await requireAuth();
const status = document.getElementById("status");

const { data, error } = await sb.from("hub_app_access").select("app_id").eq("app_id", "nutrition");
if (error) status.textContent = t("loadFail", { msg: error.message });
else if (!data.length) status.textContent = t("noAccess");
else {
  try {
    const store = createStore(sb);
    await store.goals(); // proves the tables exist and are readable before the page is shown

    // Tabs: all views live in this page; the current one is kept in the URL hash.
    const VIEWS = ["day", "presets", "weight", "trends"];
    const viewFromHash = () => {
      const v = location.hash.slice(1).split("?")[0];
      return VIEWS.includes(v) ? v : "day";
    };
    const showView = (view) => {
      for (const v of VIEWS) {
        document.getElementById(`${v}View`).hidden = v !== view;
        document.getElementById(`tab_${v}`).setAttribute("aria-pressed", String(v === view));
      }
    };
    for (const v of VIEWS) {
      document.getElementById(`tab_${v}`).addEventListener("click", () => {
        try { history.replaceState(null, "", `#${v}`); } catch { /* ignore */ }
        showView(v);
      });
    }
    window.addEventListener("hashchange", () => showView(viewFromHash()));
    showView(viewFromHash());

    // Settings overlay: opened here, filled by settings.js in a later step.
    const overlay = document.getElementById("settingsOverlay");
    const closeSettings = () => overlay.classList.remove("open");
    document.getElementById("openSettings").addEventListener("click", () => overlay.classList.add("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target.closest("[data-close]")) closeSettings(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSettings(); });

    status.remove();
    document.getElementById("app").hidden = false;
  } catch (e) {
    status.textContent = t("loadFail", { msg: e.message });
  }
}
