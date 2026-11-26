// Strings for the cycle app. Words every app shares (Home, Save, Close, ...) live in shared/i18n.js.
import { createI18n } from "../../shared/i18n.js";

const STR = {
  en: { title: "Cycle", empty: "Nothing here yet." },
  zh: { title: "周期", empty: "这里还没有内容。" },
};

export const { t, applyStatic } = createI18n({ strings: STR });
