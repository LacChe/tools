// Strings for the nutrition app. Words every app shares (Home, Save, Date, ...) live in shared/i18n.js.
// Imports inside this app carry ?v=N: raise it everywhere when a file changes, or a phone can mix new and saved files.
import { createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Nutrition", day: "Day", presets: "Presets", weight: "Weight", trends: "Trends",
    goals: "Goal", goalHistory: "Goal history", protein: "Protein", fat: "Fat", carbs: "Carbs", kcal: "kcal",
    effectiveFrom: "Effective from", noGoals: "No goal set yet.", unitSystem: "Units",
    system_metric: "Metric", system_us: "US standard",
    badGoal: "Enter protein, fat and carbs as numbers from 0 to under 100,000, and a date.",
    saveFail: "Could not save: {msg}",
    unit_g: "g", unit_kg: "kg", unit_oz: "oz", unit_lb: "lb", unit_ml: "ml", unit_l: "l",
    unit_tsp: "tsp", unit_tbsp: "tbsp", unit_cup: "cup", unit_fl_oz: "fl oz", unit_piece: "piece", unit_serving: "serving",
  },
  zh: {
    title: "营养", day: "每日", presets: "预设", weight: "体重", trends: "趋势",
    goals: "目标", goalHistory: "目标记录", protein: "蛋白质", fat: "脂肪", carbs: "碳水", kcal: "千卡",
    effectiveFrom: "生效日期", noGoals: "尚未设置目标。", unitSystem: "单位",
    system_metric: "公制", system_us: "美制",
    badGoal: "请输入蛋白质、脂肪和碳水（0 到 100,000 以内的数字）以及日期。",
    saveFail: "无法保存：{msg}",
    unit_g: "克", unit_kg: "千克", unit_oz: "盎司", unit_lb: "磅", unit_ml: "毫升", unit_l: "升",
    unit_tsp: "茶匙", unit_tbsp: "汤匙", unit_cup: "杯", unit_fl_oz: "液量盎司", unit_piece: "个", unit_serving: "份",
  },
};

export const { t, getLang, applyStatic } = createI18n({ strings: STR });
