// Language support for the expenses app: English and Simplified Chinese.
// The choice is kept in localStorage so it survives closing the page.

const KEY = "expenses.lang";
export const LANGS = { en: "English", zh: "简体中文" };

const STR = {
  en: {
    home: "Home", title: "Expenses", settings: "Settings", view: "View", close: "Close",
    records: "Records", reports: "Reports", date: "Date", currency: "Currency", type: "Type",
    amount: "Amount", add: "Add", from: "From", to: "To", save: "Save", delete: "Delete",
    deleteArm: "Tap again to delete", editEntry: "Edit entry", defaultCurrency: "Default currency",
    language: "Language", loading: "Loading…", spendingByType: "Spending by type",
    noRange: "No entries in this range.", noEntries: "No entries yet.", end: "You've reached the end.",
    moreFail: "Couldn't load more. Tap to retry.", loadFail: "Could not load data: {msg}",
    noAccess: "No access to this app.", badAmount: "Enter a valid amount.", bigAmount: "Amount is too large.",
    chooseType: "Choose a type.", added: "Added {amt} {cur} to {cat}", defaultSet: "Default currency set to {cur}",
    perDay: "Spending per day", perWeek: "Spending per week", perMonth: "Spending per month", weekOf: "Week of ",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  zh: {
    home: "主页", title: "支出", settings: "设置", view: "视图", close: "关闭",
    records: "记录", reports: "报表", date: "日期", currency: "币种", type: "类型",
    amount: "金额", add: "添加", from: "从", to: "至", save: "保存", delete: "删除",
    deleteArm: "再点一次确认删除", editEntry: "编辑记录", defaultCurrency: "默认币种",
    language: "语言", loading: "加载中…", spendingByType: "按类型统计支出",
    noRange: "此范围内没有记录。", noEntries: "暂无记录。", end: "已经到底了。",
    moreFail: "加载失败，点按重试。", loadFail: "无法加载数据：{msg}",
    noAccess: "无权使用此应用。", badAmount: "请输入有效金额。", bigAmount: "金额过大。",
    chooseType: "请选择类型。", added: "已添加 {amt} {cur} 到「{cat}」", defaultSet: "默认币种已设为 {cur}",
    perDay: "每日支出", perWeek: "每周支出", perMonth: "每月支出", weekOf: "起始周：",
    weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  },
};

let lang = "en";
try { const s = localStorage.getItem(KEY); if (s in LANGS) lang = s; } catch { /* storage unavailable */ }

export const getLang = () => lang;
export const t = (key, vars = {}) => {
  const s = STR[lang][key] ?? STR.en[key] ?? key;
  return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
};

// Display names for database rows (lookup tables carry label_en and label_zh).
export const catName = (row) => (lang === "zh" && row.label_zh) || row.label_en;
export const curName = catName;

// Fills every [data-i18n] (text), [data-i18n-aria] (aria-label) element, plus <html lang> and the title.
export const applyStatic = () => {
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  document.title = t("title");
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
};

export const setLang = (next) => {
  if (!(next in LANGS) || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: still applies for this visit */ }
  applyStatic();
  document.dispatchEvent(new Event("expenses:lang"));
};
