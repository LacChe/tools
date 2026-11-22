// Language support for the exercise app: English and Simplified Chinese.
// The choice is kept in localStorage so it survives closing the page.

const KEY = "exercise.lang";
export const LANGS = { en: "English", zh: "简体中文" };

const STR = {
  en: {
    home: "Home", title: "Exercise", settings: "Settings", view: "View", close: "Close",
    log: "Log", history: "History", progress: "Progress", library: "Library", language: "Language",
    loading: "Loading…", loadFail: "Could not load data: {msg}", noAccess: "No access to this app.",
    comingLog: "The log page comes in step 4.", comingHistory: "The history page comes in step 6.",
    comingProgress: "The progress page comes in step 8.", comingLibrary: "The library comes in step 3.",
  },
  zh: {
    home: "主页", title: "运动", settings: "设置", view: "视图", close: "关闭",
    log: "记录", history: "历史", progress: "进度", library: "动作库", language: "语言",
    loading: "加载中…", loadFail: "无法加载数据：{msg}", noAccess: "无权使用此应用。",
    comingLog: "记录页面将在第 4 步完成。", comingHistory: "历史页面将在第 6 步完成。",
    comingProgress: "进度页面将在第 8 步完成。", comingLibrary: "动作库将在第 3 步完成。",
  },
};

let lang = "en";
try { const s = localStorage.getItem(KEY); if (s in LANGS) lang = s; } catch { /* storage unavailable */ }

export const getLang = () => lang;
export const t = (key, vars = {}) => {
  const s = STR[lang][key] ?? STR.en[key] ?? key;
  return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
};

// Display name for rows with name_en / name_zh (catalog, routines): current language, falling back to the other.
export const nameOf = (row) => (lang === "zh" ? row.name_zh || row.name_en : row.name_en || row.name_zh) ?? "";
// Display name for lookup rows with label_en / label_zh (categories).
export const labelOf = (row) => (lang === "zh" && row.label_zh) || row.label_en;

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
  document.dispatchEvent(new Event("exercise:lang"));
};
