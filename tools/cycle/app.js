import { sb, requireAuth, signOut } from "../../auth.js";
import { loadKeys } from "../../shared/cycle-keys.js";
import { t, applyStatic } from "./i18n.js?v=2";
import { createStore } from "./store.js?v=1";
import { createEditor } from "./editor.js?v=2";
import { renderDetails } from "./details.js?v=1";
import { today } from "../../shared/dates.js";

applyStatic();
const session = await requireAuth();
const status = document.getElementById("status");

const { data, error } = await sb.from("hub_app_access").select("app_id").eq("app_id", "cycle");
if (error) status.textContent = t("loadFail", { msg: error.message });
else if (!data.length) status.textContent = t("noAccess");
else {
  try {
    // No keys on this device: sign out here, so that signing in again unlocks them.
    const keys = await loadKeys(session.user.id);
    if (!keys) await signOut();
    else {
      const store = createStore(sb, keys);
      const unreadable = await store.load();
      createEditor(store);
      // Log / Details switch. Details are worked out again each time they are opened.
      const showView = (details) => {
        document.getElementById("logView").hidden = details;
        document.getElementById("detailsView").hidden = !details;
        document.getElementById("tabLog").setAttribute("aria-pressed", String(!details));
        document.getElementById("tabDetails").setAttribute("aria-pressed", String(details));
        if (details) renderDetails(document.getElementById("detailsView"), store.entries, today());
      };
      document.getElementById("tabLog").addEventListener("click", () => showView(false));
      document.getElementById("tabDetails").addEventListener("click", () => showView(true));
      if (unreadable) {
        const note = document.getElementById("readError");
        note.textContent = t("unreadable", { n: unreadable });
        note.hidden = false;
      }
      status.remove();
      document.getElementById("app").hidden = false;
    }
  } catch (e) {
    status.textContent = t("loadFail", { msg: e.message });
  }
}
