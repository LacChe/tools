import { sb, requireAuth } from "../../auth.js";
import { t, applyStatic } from "./i18n.js";

applyStatic();
await requireAuth();
const status = document.getElementById("status");

const { data, error } = await sb.from("hub_app_access").select("app_id").eq("app_id", "cycle");
if (error) status.textContent = t("loadFail", { msg: error.message });
else if (!data.length) status.textContent = t("noAccess");
else {
  status.remove();
  document.getElementById("app").hidden = false;
}
