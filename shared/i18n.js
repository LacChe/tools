// Language support shared by the apps: English and Simplified Chinese.
//
// One saved choice for the whole hub (localStorage "hub.lang", set in the hub's settings); each app keeps its own strings and
// builds its translator with createI18n(). Text that comes from the database (names, labels) is not
// translated here: those rows carry _en / _zh columns and are picked with nameOf / labelOf.

export const LANGS = { en: "English", zh: "简体中文" };
const KEY = "hub.lang";

// Words every app needs. An app's own strings win if it defines the same key.
const COMMON = {
  en: {
    home: "Home", settings: "Settings", view: "View", close: "Close", language: "Language",
    loading: "Loading…", loadFail: "Could not load data: {msg}", noAccess: "No access to this app.",
    date: "Date", from: "From", to: "To", save: "Save", delete: "Delete", deleteArm: "Tap again to delete",
    end: "You've reached the end.", moreFail: "Couldn't load more. Tap to retry.",
  },
  zh: {
    home: "主页", settings: "设置", view: "视图", close: "关闭", language: "语言",
    loading: "加载中…", loadFail: "无法加载数据：{msg}", noAccess: "无权使用此应用。",
    date: "日期", from: "从", to: "至", save: "保存", delete: "删除", deleteArm: "再点一次确认删除",
    end: "已经到底了。", moreFail: "加载失败，点按重试。",
  },
};

// Keys the apps used before the language moved to the hub. Remove once every device has opened the hub.
const LEGACY_KEYS = ["expenses.lang", "exercise.lang"];

// The language saved in the hub (hub.lang), else an old per-app choice, else English.
const readSaved = () => {
  try {
    for (const k of [KEY, ...LEGACY_KEYS]) {
      const s = localStorage.getItem(k);
      if (Object.hasOwn(LANGS, s)) return s;
    }
  } catch { /* storage unavailable */ }
  return "en";
};

// strings: { en: {...}, zh: {...} } for this page. The language is chosen in the hub; apps only read it.
export function createI18n({ strings }) {
  const STR = Object.fromEntries(Object.keys(LANGS).map((l) => [l, { ...COMMON[l], ...strings[l] }]));
  for (const k of Object.keys(STR.en)) if (!(k in STR.zh)) console.warn(`i18n: "${k}" has no zh string`);

  let lang = readSaved();

  const getLang = () => lang;
  const t = (key, vars = {}) => {
    const s = STR[lang][key] ?? STR.en[key] ?? key;
    return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
  };

  // Display name for rows with name_en / name_zh: current language, falling back to the other.
  const nameOf = (row) => (lang === "zh" ? row.name_zh || row.name_en : row.name_en || row.name_zh) ?? "";
  // Display name for lookup rows with label_en / label_zh (categories, currencies).
  const labelOf = (row) => (lang === "zh" && row.label_zh) || row.label_en;

  // Fills every [data-i18n] (text), [data-i18n-aria] (aria-label) and [data-i18n-placeholder] element, plus <html lang> and the title.
  const applyStatic = () => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.title = t("title");
    for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
    for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  };

  const setLang = (next) => {
    if (!(next in LANGS) || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: still applies for this visit */ }
    applyStatic();
  };

  return { getLang, t, nameOf, labelOf, applyStatic, setLang };
}
