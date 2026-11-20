import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";

// Publishable key: safe to ship. Access is enforced by row-level security.
const SUPABASE_URL = "https://ystddrpqrtduvfwsdvft.supabase.co";
const SUPABASE_KEY = "sb_publishable_Gg3S18BZDVZzGD1lU3F0Gw_rjTI3Qw0";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resolved against this file, so it works from any page depth under /tools/.
const LOGIN_URL = new URL("login.html", import.meta.url).href;
const HOME_URL = new URL("index.html", import.meta.url).href;

export async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    location.replace(LOGIN_URL);
    return new Promise(() => {}); // never resolves; page is navigating away
  }
  return data.session;
}

export async function signOut() {
  await sb.auth.signOut();
  location.replace(LOGIN_URL);
}

export { HOME_URL };
