// The Details tab: last and range figures, the typical period, and past cycles lined up on day 1.
import { addDays, parseISO } from "../../shared/dates.js";
import { t, getLang } from "./i18n.js?v=3";
import { analyse, FLOWS } from "./rules.js?v=1";
import { dayColor, painColor } from "./colors.js?v=1";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const shortDate = (iso) => parseISO(iso).toLocaleDateString(getLang() === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" });

// A block whose height shows the amount of bleeding. Days without bleeding stay flat.
function block(flow, color, unlogged) {
  const b = el("i", unlogged ? "day-block unlogged" : "day-block");
  b.style.setProperty("--day", color);
  b.style.setProperty("--level", Math.max(0, FLOWS.indexOf(flow ?? "none")));
  return b;
}

export function renderDetails(box, entries, today) {
  const info = analyse(entries, today);
  if (!info.enough) {
    box.replaceChildren(el("p", "empty", t("notEnough")));
    return;
  }

  const figures = el("div", "figures");
  for (const [label, s] of [["lastCycle", info.cycleStats], ["lastPeriod", info.periodStats]]) {
    if (!s) continue;
    const card = el("div", "card");
    card.append(el("span", "ex-label", t(label)), el("strong", "", `${s.last} (${s.min}–${s.max})`));
    figures.append(card);
  }

  const typical = el("div", "card typical");
  info.typical.forEach((day, i) => {
    const col = el("div", "typical-day");
    col.append(block(day.flow, painColor("var(--cycle-bleed)", day.pain)), el("span", "ex-label", String(i + 1)));
    typical.append(col);
  });

  const past = el("div", "card");
  const longest = Math.max(...info.cycles.map((c) => c.length));
  for (const cycle of [...info.cycles].reverse()) {
    const days = el("div", "cycle-days");
    days.style.setProperty("--columns", longest);
    for (let i = 0; i < cycle.length; i++) {
      const entry = entries.get(addDays(cycle.start, i));
      days.append(block(entry?.flow, dayColor(entry, i, cycle.length, cycle.period), !entry));
    }
    const row = el("div", "cycle-row");
    row.append(el("span", "cycle-start", shortDate(cycle.start)), days, el("span", "cycle-length", String(cycle.length)));
    past.append(row);
  }

  box.replaceChildren(
    figures,
    el("h2", "sec-title", t("typical")), typical, el("p", "ex-label", t("typicalNote")),
    el("h2", "sec-title", t("past")), past, el("p", "ex-label", t("pastNote")),
  );
}
