// Strings for the cycle app. Words every app shares (Home, Save, Date, ...) live in shared/i18n.js.
import { createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Cycle", flow: "Flow", pain: "Pain", note: "Note", clearDay: "Clear day",
    flow_none: "None", flow_spotting: "Spotting", flow_light: "Light", flow_medium: "Medium", flow_heavy: "Heavy",
    pain_none: "None", pain_mild: "Mild", pain_moderate: "Moderate", pain_severe: "Severe",
    saved: "Saved", cleared: "Day cleared", saveFail: "Could not save: {msg}", badDate: "Choose a date up to today.",
    changedElsewhere: "This day was changed on another device. Its saved values are shown now.",
    dayUnreadable: "The saved entry for this day cannot be read, so it will not be overwritten.",
    unreadable: "Entries that could not be read: {n}",
  },
  zh: {
    title: "周期", flow: "经量", pain: "疼痛", note: "备注", clearDay: "清除当天",
    flow_none: "无", flow_spotting: "点滴", flow_light: "少量", flow_medium: "中等", flow_heavy: "大量",
    pain_none: "无", pain_mild: "轻度", pain_moderate: "中度", pain_severe: "重度",
    saved: "已保存", cleared: "已清除当天记录", saveFail: "无法保存：{msg}", badDate: "请选择今天或之前的日期。",
    changedElsewhere: "这一天已在其他设备上修改。现在显示的是已保存的内容。",
    dayUnreadable: "这一天的已保存记录无法读取，因此不会覆盖它。",
    unreadable: "无法读取的记录数：{n}",
  },
};

export const { t, applyStatic } = createI18n({ strings: STR });
