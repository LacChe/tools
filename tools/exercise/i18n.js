// Language support for the exercise app: English and Simplified Chinese.
// The choice is kept in localStorage so it survives closing the page.

const KEY = "exercise.lang";
export const LANGS = { en: "English", zh: "简体中文" };

const STR = {
  en: {
    home: "Home", title: "Exercise", settings: "Settings", view: "View", close: "Close",
    log: "Log", history: "History", progress: "Progress", library: "Library", language: "Language",
    loading: "Loading…", loadFail: "Could not load data: {msg}", noAccess: "No access to this app.",
    comingProgress: "The progress page comes in step 8.",
    prevDay: "Previous day", nextDay: "Next day", date: "Date", bodyweight: "Body weight", notes: "Notes",
    noSets: "Nothing logged this day.", logAddExercise: "Add exercise", lastTime: "Last time: {text}",
    addSet: "+ set", setN: "Set {n}", pickTitle: "Choose exercise", noMatch: "No matching exercises.",
    createNew: "Create new exercise", copyLast: "Copy last set", addMetric: "+ {metric}", side: "Side",
    sideNone: "Both / not set", sideLeft: "Left", sideRight: "Right", warmup: "Warm-up", saveSet: "Save set",
    addSetTitle: "Add set", editSetTitle: "Edit set", needValue: "Enter {metric}.", badNumber: "Enter a valid value for {metric}.",
    logFail: "Could not save: {msg}", loadDayFail: "Could not load this day: {msg}", retry: "Retry", warmupTag: "warm-up",
    missingExercise: "Missing exercise",
    noHistory: "No workouts logged yet.", end: "You've reached the end.", moreFail: "Couldn't load more. Tap to retry.",
    historyFail: "Could not load history: {msg}", setCount: "{n} sets", oneSet: "1 set",
    search: "Search exercises", category: "Category", allCategories: "All categories", showArchived: "Show archived",
    newExercise: "New exercise", noExercises: "No exercises found.", archivedTag: "archived", by: "by {name}",
    variantOf: "variant of {name}", unnamed: "(unnamed)", optionalSuffix: "{names} optional",
    mReps: "reps", mWeight: "weight", mDuration: "duration", mDistance: "distance", mVolume: "volume",
    editExercise: "Edit exercise", viewExercise: "Exercise", addExercise: "New exercise",
    nameEn: "Name (English)", nameZh: "Name (中文)", noCategory: "No category", parent: "Variant of (optional)", noParent: "None",
    requiredMetrics: "Always logged", optionalMetrics: "Optional (behind a toggle)", primaryMetric: "Chart metric",
    unilateral: "Done one side at a time", save: "Save", archive: "Archive", unarchive: "Unarchive",
    duplicate: "Duplicate", delete: "Delete", deleteArm: "Tap again to delete", openExisting: "Open existing",
    needName: "Enter a name in English or Chinese.", needMetric: "Pick at least one always-logged metric.",
    nameTaken: "An exercise with this name already exists: {name}.", nameTakenArchived: "An exercise with this name already exists (archived): {name}.",
    badData: "These values were rejected. Check the names and metrics.", hasSets: "This exercise has logged sets. Archive it instead.",
    saveFail: "Could not save: {msg}", notYours: "Created by {name}. Only they can edit it; you can duplicate it.",
  },
  zh: {
    home: "主页", title: "运动", settings: "设置", view: "视图", close: "关闭",
    log: "记录", history: "历史", progress: "进度", library: "动作库", language: "语言",
    loading: "加载中…", loadFail: "无法加载数据：{msg}", noAccess: "无权使用此应用。",
    comingProgress: "进度页面将在第 8 步完成。",
    prevDay: "前一天", nextDay: "后一天", date: "日期", bodyweight: "体重", notes: "备注",
    noSets: "这一天没有记录。", logAddExercise: "添加动作", lastTime: "上次：{text}",
    addSet: "+ 一组", setN: "第 {n} 组", pickTitle: "选择动作", noMatch: "没有匹配的动作。",
    createNew: "新建动作", copyLast: "复制上一组", addMetric: "+ {metric}", side: "侧",
    sideNone: "双侧 / 未设置", sideLeft: "左", sideRight: "右", warmup: "热身", saveSet: "保存本组",
    addSetTitle: "添加一组", editSetTitle: "编辑本组", needValue: "请输入{metric}。", badNumber: "{metric}的值无效。",
    logFail: "无法保存：{msg}", loadDayFail: "无法加载这一天：{msg}", retry: "重试", warmupTag: "热身",
    missingExercise: "动作已缺失",
    noHistory: "还没有训练记录。", end: "已经到底了。", moreFail: "加载失败，点按重试。",
    historyFail: "无法加载历史：{msg}", setCount: "{n} 组", oneSet: "1 组",
    search: "搜索动作", category: "分类", allCategories: "全部分类", showArchived: "显示已归档",
    newExercise: "新建动作", noExercises: "没有找到动作。", archivedTag: "已归档", by: "创建者：{name}",
    variantOf: "属于：{name}", unnamed: "（未命名）", optionalSuffix: "可选：{names}",
    mReps: "次数", mWeight: "重量", mDuration: "时长", mDistance: "距离", mVolume: "总量",
    editExercise: "编辑动作", viewExercise: "动作", addExercise: "新建动作",
    nameEn: "名称（English）", nameZh: "名称（中文）", noCategory: "无分类", parent: "属于（可选）", noParent: "无",
    requiredMetrics: "必须记录", optionalMetrics: "可选（需展开）", primaryMetric: "图表指标",
    unilateral: "分左右两侧做", save: "保存", archive: "归档", unarchive: "取消归档",
    duplicate: "复制", delete: "删除", deleteArm: "再点一次确认删除", openExisting: "打开已有动作",
    needName: "请输入英文或中文名称。", needMetric: "请至少选择一个必须记录的指标。",
    nameTaken: "已存在同名动作：{name}。", nameTakenArchived: "已存在同名动作（已归档）：{name}。",
    badData: "数据被拒绝，请检查名称和指标。", hasSets: "此动作已有训练记录，请改为归档。",
    saveFail: "无法保存：{msg}", notYours: "由 {name} 创建，只有 TA 可以编辑；你可以复制。",
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
