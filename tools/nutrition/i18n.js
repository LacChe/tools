// Strings for the nutrition app. Words every app shares (Home, Save, Date, ...) live in shared/i18n.js.
// Imports inside this app carry ?v=N: raise it everywhere when a file changes, or a phone can mix new and saved files.
import { createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Nutrition", day: "Day", presets: "Presets", weight: "Weight", trends: "Trends",
  },
  zh: {
    title: "营养", day: "每日", presets: "预设", weight: "体重", trends: "趋势",
  },
};

export const { t, getLang, applyStatic } = createI18n({ strings: STR });
