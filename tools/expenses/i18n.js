// Strings for the expenses app. Words every app shares (Home, Save, Close, ...) live in shared/i18n.js.
import { LANGS, createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Expenses", records: "Records", reports: "Reports", currency: "Currency", type: "Type",
    amount: "Amount", add: "Add", editEntry: "Edit entry", defaultCurrency: "Default currency",
    spendingByType: "Spending by type", noRange: "No entries in this range.", noEntries: "No entries yet.",
    badAmount: "Enter a valid amount.", bigAmount: "Amount is too large.",
    chooseType: "Choose a type.", added: "Added {amt} {cur} to {cat}", defaultSet: "Default currency set to {cur}",
    perDay: "Spending per day", perWeek: "Spending per week", perMonth: "Spending per month", weekOf: "Week of ",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  zh: {
    title: "支出", records: "记录", reports: "报表", currency: "币种", type: "类型",
    amount: "金额", add: "添加", editEntry: "编辑记录", defaultCurrency: "默认币种",
    spendingByType: "按类型统计支出", noRange: "此范围内没有记录。", noEntries: "暂无记录。",
    badAmount: "请输入有效金额。", bigAmount: "金额过大。",
    chooseType: "请选择类型。", added: "已添加 {amt} {cur} 到「{cat}」", defaultSet: "默认币种已设为 {cur}",
    perDay: "每日支出", perWeek: "每周支出", perMonth: "每月支出", weekOf: "起始周：",
    weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  },
};

const i18n = createI18n({ strings: STR, event: "expenses:lang", legacyKey: "expenses.lang" });

export { LANGS };
export const { getLang, t, applyStatic, setLang } = i18n;
// Display names for database rows (lookup tables carry label_en and label_zh).
export const catName = i18n.labelOf;
export const curName = i18n.labelOf;
