import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
import { clearKeys } from "./shared/cycle-keys.js";

// Publishable key: safe to ship. Access is enforced by row-level security.
const SUPABASE_URL = "https://ystddrpqrtduvfwsdvft.supabase.co";
const SUPABASE_KEY = "sb_publishable_Gg3S18BZDVZzGD1lU3F0Gw_rjTI3Qw0";

// Resolved against this file, so it works from any page depth under /tools/.
const LOGIN_URL = new URL("login.html", import.meta.url).href;
const HOME_URL = new URL("index.html", import.meta.url).href;

const goLogin = () => {
  if (location.href.split(/[?#]/)[0] !== LOGIN_URL) location.replace(LOGIN_URL);
};
const isNetworkError = (e) => e?.name === "AuthRetryableFetchError"; // offline or server unreachable: not a reason to sign out

// Every database request goes through here. If the server rejects the sign-in token (401: expired, or the device
// clock is off so the browser did not notice), refresh it once and retry. If it cannot be refreshed, go to login.
// Pages and tools need no code of their own for this.
async function fetchWithRefresh(input, init) {
  const res = await fetch(input, init);
  const url = String(input?.url ?? input);
  if (res.status !== 401 || !url.startsWith(`${SUPABASE_URL}/rest/v1/`)) return res;
  const { data, error } = await sb.auth.refreshSession();
  if (error || !data.session) {
    if (!isNetworkError(error)) goLogin();
    return res;
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: fetchWithRefresh } });

// Signed out here, in another tab, or because the refresh token is no longer valid: back to login.
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") goLogin(); });

export async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    goLogin();
    return new Promise(() => {}); // never resolves; page is navigating away
  }
  return data.session;
}

export async function signOut() {
  // The login page clears these too, which covers automatic sign-outs.
  await clearKeys();
  // "local" ends only this device's session. The default would end every device's, so signing out in one browser
  // broke the others ("Not signed in").
  const { error } = await sb.auth.signOut({ scope: "local" });
  // If the server could not be reached, the library keeps the saved sign-in and the login page would send you
  // straight back in. Drop it here instead.
  if (error) localStorage.removeItem(sb.auth.storageKey);
  goLogin();
}

export { HOME_URL };
