// Strings for the cycle app. Words every app shares (Home, Save, Date, ...) live in shared/i18n.js.
// Imports inside this app carry ?v=N: raise it everywhere when a file changes, or a phone can mix new and saved files.
import { createI18n } from "../../shared/i18n.js";

const STR = {
  en: {
    title: "Cycle", spiral: "Cycle spiral", legend: "Legend", cycleDay: "Day {n}", prevDay: "Previous day", nextDay: "Next day",
    firstUse: "Add the days of your past periods to start.", logged: "Logged", unlogged: "Not logged",
    legend_mild: "Mild pain", legend_moderate: "Moderate pain", legend_severe: "Severe pain",
    log: "Log", details: "Details",
    lastCycle: "Last cycle", lastPeriod: "Last period", typical: "Your typical period", past: "Past cycles",
    typicalNote: "Height: usual flow. Shade: usual pain.", pastNote: "Start date and days in each cycle. Outlined days are not logged.",
    notEnough: "Not enough data yet. Figures appear after two completed cycles.",
    flow: "Flow", pain: "Pain", note: "Note", clearDay: "Clear day",
    flow_none: "None", flow_spotting: "Spotting", flow_light: "Light", flow_medium: "Medium", flow_heavy: "Heavy",
    pain_none: "None", pain_mild: "Mild", pain_moderate: "Moderate", pain_severe: "Severe",
    saved: "Saved", cleared: "Day cleared", saveFail: "Could not save: {msg}", badDate: "Choose a date up to today.",
    changedElsewhere: "This day was changed on another device. Its saved values are shown now.",
    dayUnreadable: "The saved entry for this day cannot be read, so it will not be overwritten.",
    unreadable: "Entries that could not be read: {n}",
  },
  zh: {
    title: "周期", spiral: "周期螺旋图", legend: "图例", cycleDay: "第{n}天", prevDay: "前一天", nextDay: "后一天",
    firstUse: "请先补记过往经期的日子。", logged: "已记录", unlogged: "未记录",
    legend_mild: "轻度疼痛", legend_moderate: "中度疼痛", legend_severe: "重度疼痛",
    log: "记录", details: "详情",
    lastCycle: "上次周期", lastPeriod: "上次经期", typical: "典型经期", past: "过往周期",
    typicalNote: "高度：通常经量。深浅：通常疼痛。", pastNote: "开始日期与每个周期的天数。描边的日子未记录。",
    notEnough: "数据还不够。完成两个周期后显示统计。",
    flow: "经量", pain: "疼痛", note: "备注", clearDay: "清除当天",
    flow_none: "无", flow_spotting: "点滴", flow_light: "少量", flow_medium: "中等", flow_heavy: "大量",
    pain_none: "无", pain_mild: "轻度", pain_moderate: "中度", pain_severe: "重度",
    saved: "已保存", cleared: "已清除当天记录", saveFail: "无法保存：{msg}", badDate: "请选择今天或之前的日期。",
    changedElsewhere: "这一天已在其他设备上修改。现在显示的是已保存的内容。",
    dayUnreadable: "这一天的已保存记录无法读取，因此不会覆盖它。",
    unreadable: "无法读取的记录数：{n}",
  },
};

export const { t, getLang, applyStatic } = createI18n({ strings: STR });
