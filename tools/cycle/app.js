import { sb, requireAuth, signOut } from "../../auth.js";
import { loadKeys } from "../../shared/cycle-keys.js";
import { t, applyStatic } from "./i18n.js";

applyStatic();
const session = await requireAuth();
const status = document.getElementById("status");

const { data, error } = await sb.from("hub_app_access").select("app_id").eq("app_id", "cycle");
if (error) status.textContent = t("loadFail", { msg: error.message });
else if (!data.length) status.textContent = t("noAccess");
else {
  try {
    // No keys on this device: sign out here, so that signing in again unlocks them.
    if (!(await loadKeys(session.user.id))) await signOut();
    else {
      status.remove();
      document.getElementById("app").hidden = false;
    }
  } catch (e) {
    status.textContent = t("loadFail", { msg: e.message }); // this browser cannot store keys
  }
}
