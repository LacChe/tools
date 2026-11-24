// Strings for the hub page and the login page. The language is chosen here (hub settings) and saved per device.
import { LANGS, createI18n } from "./shared/i18n.js";

const STR = {
  en: { title: "Tools", signOut: "Sign out", signIn: "Sign in", email: "Email", password: "Password" },
  zh: { title: "工具", signOut: "退出登录", signIn: "登录", email: "邮箱", password: "密码" },
};

const i18n = createI18n({ strings: STR });
export { LANGS };
export const { getLang, t, nameOf, applyStatic, setLang } = i18n;
