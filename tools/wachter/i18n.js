// Strings for the Wachter app. Words every app shares (Home, Close, Loading, ...) live in shared/i18n.js.
// The entries themselves (labels, titles, bodies) come from the database with _en / _zh columns.
import { LANGS, createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Practice Dependency Web",
    subtitle: "Columns = build-order stage (left = foundational, right = depends on the most). Click a box for its cheat-sheet entry, click a line to trace a single connection.",
    legendWF: "Weaving Fate",
    legendSW: "Six Ways",
    legendReq: "builds on / requires",
    legendOpt: "pairs with / optional",
    hint: "click empty space to reset",
    footnote: "Loop-shaped dashed lines below a pair indicate a back-reference (e.g. Walking the Corridor ↔ The Fever Stone).",
    bookWf: "Weaving Fate",
    bookSw: "Six Ways",
  },
  zh: {
    title: "练习依赖关系图",
    subtitle: "列 = 建构阶段（左：基础，右：依赖最多）。同列内按由浅入深排列。点击方块查看该练习的完整条目，点击连线可单独追踪一条依赖关系。",
    legendWF: "《编织命运》",
    legendSW: "《六合》",
    legendReq: "以此为基础／必要",
    legendOpt: "可搭配／可选",
    hint: "点击空白处可重置",
    footnote: "回环状虚线表示一种反向引用（例如「行于甬道」与「热病石」互相引用）。",
    bookWf: "编织命运",
    bookSw: "六合",
  },
};

const i18n = createI18n({ strings: STR, event: "wachter:lang" });

export { LANGS };
export const { getLang, t, applyStatic, setLang } = i18n;
