import { sb, requireAuth, signOut } from "../../auth.js";
import { loadKeys } from "../../shared/cycle-keys.js";
import { t, getLang, applyStatic } from "./i18n.js?v=5";
import { createStore } from "./store.js?v=1";
import { createEditor } from "./editor.js?v=5";
import { renderDetails } from "./details.js?v=5";
import { renderSpiral } from "./spiral.js?v=5";
import { addDays, parseISO, today } from "../../shared/dates.js";

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
      const $ = (id) => document.getElementById(id);
      let shownDay = today();
      const draw = () => {
        shownDay = today();
        renderSpiral($("spiral"), store.entries, shownDay, openDay);
        $("firstUse").hidden = store.entries.size > 0;
      };
      const editor = createEditor(store, draw);

      // Day panel: the same form with the date fixed, and arrows to the days either side.
      const form = $("entryForm");
      let before = null; // the date the top form showed; null while the panel is closed
      const showDay = (day) => {
        $("dayTitle").textContent = parseISO(day).toLocaleDateString(getLang() === "zh" ? "zh-CN" : "en-US",
          { month: "short", day: "numeric", weekday: "short" });
        $("dayNext").disabled = day >= today();
        editor.open(day);
      };
      function openDay(day) {
        if (editor.isBusy()) return;
        before = editor.date();
        $("daySlot").append(form);
        form.classList.add("in-panel");
        $("dayOverlay").classList.add("open");
        showDay(day);
      }
      const closeDay = () => {
        if (before === null || editor.isBusy()) return;
        $("formSlot").append(form);
        form.classList.remove("in-panel");
        $("dayOverlay").classList.remove("open");
        editor.open(before);
        before = null;
      };
      const move = (by) => { if (!editor.isBusy()) showDay(addDays(editor.date(), by)); };
      $("dayPrev").addEventListener("click", () => move(-1));
      $("dayNext").addEventListener("click", () => move(1));
      $("dayClose").addEventListener("click", closeDay);
      $("dayOverlay").addEventListener("click", (e) => { if (e.target === $("dayOverlay")) closeDay(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDay(); });

      // The app can stay open past midnight: keep today at the top.
      const checkDay = () => {
        if (today() === shownDay) return;
        editor.newDay(shownDay);
        draw();
      };
      document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
      setInterval(checkDay, 60000);

      draw();
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
