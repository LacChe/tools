// The settings overlay: add a goal, read the goal history, pick the unit system.
// Gets everything through ctx; must not import the store or any other view.
import { kcal } from "./macros.js?v=1";
import { parseNum } from "../../shared/numbers.js";

const MAX = 100000; // a macro goal must be below this
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

export function mount(root, ctx) {
  const { store, t, prefs, today } = ctx;
  const field = (label, input) => el("label", { className: "field" }, el("span", { textContent: label }), input);
  const num = () => el("input", { type: "text", inputMode: "decimal", autocomplete: "off" });

  const goalInputs = { protein: num(), fat: num(), carbs: num() };
  const date = el("input", { type: "date", required: true });
  const live = el("p", { className: "empty" });
  const saveBtn = el("button", { type: "submit", textContent: t("save") });
  const goalError = el("p", { className: "error", role: "alert" });
  const form = el("form", { className: "stack", noValidate: true },
    el("h3", { textContent: t("goals") }),
    el("div", { className: "field-row" },
      field(t("protein"), goalInputs.protein), field(t("fat"), goalInputs.fat), field(t("carbs"), goalInputs.carbs)),
    live,
    field(t("effectiveFrom"), date), saveBtn, goalError);

  const system = el("select", {}, ...["metric", "us"].map((v) => el("option", { value: v, textContent: t(`system_${v}`) })));
  system.value = prefs.getSystem();
  system.addEventListener("change", () => { prefs.setSystem(system.value); ctx.changed(); });

  const history = el("div", {});
  root.replaceChildren(form, el("h3", { textContent: t("goalHistory") }), history, field(t("unitSystem"), system));

  // Every field must be a number from 0 up to (not including) 100,000; empty is not allowed.
  const read = () => {
    const out = {};
    for (const [k, input] of Object.entries(goalInputs)) {
      const n = parseNum(input.value);
      if (n === null || Number.isNaN(n) || n < 0 || n >= MAX) return null;
      out[k] = n;
    }
    return out;
  };
  const showKcal = () => {
    const g = read();
    live.textContent = g ? `${Math.round(kcal(g))} ${t("kcal")}` : "";
  };
  for (const input of Object.values(goalInputs)) input.addEventListener("input", showKcal);

  const draw = (goals) => {
    if (!goals.length) { history.replaceChildren(el("p", { className: "empty", textContent: t("noGoals") })); return; }
    history.replaceChildren(...[...goals].reverse().map((g) => el("p", {
      textContent: `${g.effective_from} · ${t("protein")} ${g.protein} g · ${t("fat")} ${g.fat} g · ${t("carbs")} ${g.carbs} g · ${Math.round(kcal(g))} ${t("kcal")}`,
    })));
  };

  const refresh = async () => {
    try { draw(await store.goals()); } catch (e) { goalError.textContent = e.message; }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    goalError.textContent = "";
    const g = read();
    if (!g || !date.value) { goalError.textContent = t("badGoal"); return; }
    saveBtn.disabled = true; // so a double tap cannot save twice
    try {
      await store.addGoal({ effective_from: date.value, ...g });
      ctx.changed();
      await refresh();
    } catch (err) {
      goalError.textContent = t("saveFail", { msg: err.message });
    } finally {
      saveBtn.disabled = false;
    }
  });

  return {
    show() { date.value = today(); system.value = prefs.getSystem(); return refresh(); },
    refresh,
  };
}
