// The entry form: one day at a time. A day with an entry always shows its saved values.
import { today } from "../../shared/dates.js";
import { t } from "./i18n.js?v=2";
import { FLOWS, PAINS } from "./rules.js?v=1";

export function createEditor(store) {
  const $ = (id) => document.getElementById(id);
  const date = $("fDate");
  const note = $("fNote");
  const save = $("saveBtn");
  const clear = $("clearBtn");
  let busy = false;
  let armed = false; // Clear day needs a second tap

  // A joined row of buttons with one choice. With "optional", tapping the choice again clears it.
  function segmented(id, values, prefix, optional) {
    let value = null;
    const buttons = values.map((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t(`${prefix}_${v}`);
      b.addEventListener("click", () => { set(optional && value === v ? null : v); $("formOk").textContent = ""; });
      return b;
    });
    const set = (v) => {
      value = v;
      buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(values[i] === v)));
    };
    $(id).append(...buttons);
    return { get: () => value, set };
  }
  const flow = segmented("fFlow", FLOWS, "flow", false);
  const pain = segmented("fPain", PAINS, "pain", true);

  const message = (error = "", ok = "") => { $("formError").textContent = error; $("formOk").textContent = ok; };
  const disarm = () => { armed = false; clear.textContent = t("clearDay"); };
  const valid = () => date.value !== "" && date.value <= today();

  // Puts the saved values (or the defaults) for the chosen date into the form.
  async function show() {
    date.max = today();
    const chosen = date.value;
    const entry = store.entries.get(chosen);
    flow.set(entry?.flow ?? "none");
    pain.set(entry?.pain ?? null);
    note.value = entry?.note ?? "";
    clear.hidden = !entry;
    disarm();
    message();
    save.disabled = true;
    const unreadable = valid() && await store.isUnreadable(chosen);
    if (date.value !== chosen) return; // another date was picked meanwhile
    save.disabled = busy || unreadable;
    if (unreadable) message(t("dayUnreadable"));
  }

  // Runs a save or delete with the form locked. What was typed stays if it fails.
  async function run(action) {
    busy = true;
    message();
    for (const el of $("entryForm").elements) el.disabled = true;
    let error = "";
    let ok = "";
    let reload = false;
    try {
      ({ ok, error = "", reload = false } = await action(date.value));
    } catch (e) {
      error = e.message === "unreadable" ? t("dayUnreadable") : t("saveFail", { msg: e.message });
    }
    for (const el of $("entryForm").elements) el.disabled = false;
    busy = false;
    if (reload) await show();
    disarm();
    message(error, ok);
  }

  $("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    if (!valid()) return message(t("badDate"));
    run(async (day) => {
      const result = await store.save(day, { flow: flow.get(), pain: pain.get(), note: note.value });
      return result === "changed" ? { error: t("changedElsewhere"), reload: true } : { ok: t("saved"), reload: true };
    });
  });
  clear.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      clear.textContent = t("deleteArm");
      return;
    }
    run(async (day) => { await store.remove(day); return { ok: t("cleared"), reload: true }; });
  });
  date.addEventListener("change", show);
  note.addEventListener("input", () => { $("formOk").textContent = ""; });
  // The app can stay open past midnight.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) date.max = today(); });

  date.value = today();
  show();
}
