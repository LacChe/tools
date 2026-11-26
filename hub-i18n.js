// Strings for the hub page and the login page. The language is chosen here (hub settings) and saved per device.
import { LANGS, createI18n } from "./shared/i18n.js";

const STR = {
  en: {
    title: "Tools", signOut: "Sign out", signIn: "Sign in", email: "Email", password: "Password",
    notifications: "Notifications",
    oldPasswordInfo: "Your password has changed. Enter the previous one once to keep your Cycle entries.",
    oldPassword: "Previous password", unlock: "Unlock", continueWithoutCycle: "Continue without Cycle",
    wrongOldPassword: "That password does not open your Cycle entries.",
    cycleFail: "Signed in, but Cycle could not be set up: {msg}",
    pushEnable: "Enable notifications", pushDisable: "Turn off notifications", pushTest: "Send test notification",
    pushStateOn: "Notifications are on for this device.",
    pushStateOff: "Notifications are off for this device.",
    pushNeedsInstall: "On iPhone, add this site to your Home Screen first (Share, then Add to Home Screen), open it from the new icon, and come back here.",
    pushUnsupported: "This browser can't receive notifications.",
    pushDenied: "Notifications are blocked. Allow them for this site in your device settings.",
    pushFail: "Could not change notifications: {msg}",
    pushTestSent: "Test sent. It should arrive in a few seconds.",
    pushTestNone: "No device is registered for notifications.",
    pushTestBody: "Notifications are working.",
  },
  zh: {
    title: "工具", signOut: "退出登录", signIn: "登录", email: "邮箱", password: "密码",
    notifications: "通知",
    oldPasswordInfo: "密码已更改。请输入一次旧密码，以保留“周期”记录。",
    oldPassword: "旧密码", unlock: "解锁", continueWithoutCycle: "暂不使用“周期”",
    wrongOldPassword: "该密码无法打开“周期”记录。",
    cycleFail: "已登录，但无法设置“周期”：{msg}",
    pushEnable: "开启通知", pushDisable: "关闭通知", pushTest: "发送测试通知",
    pushStateOn: "此设备已开启通知。",
    pushStateOff: "此设备未开启通知。",
    pushNeedsInstall: "在 iPhone 上，请先将本站添加到主屏幕（分享，然后添加到主屏幕），从新图标打开后再回到这里。",
    pushUnsupported: "此浏览器无法接收通知。",
    pushDenied: "通知已被阻止。请在设备设置中允许此网站发送通知。",
    pushFail: "无法更改通知设置：{msg}",
    pushTestSent: "测试通知已发送，几秒内应会收到。",
    pushTestNone: "没有已登记接收通知的设备。",
    pushTestBody: "通知功能正常。",
  },
};

const i18n = createI18n({ strings: STR });
export { LANGS };
export const { getLang, t, nameOf, applyStatic, setLang } = i18n;
