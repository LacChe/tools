// Cycle logger keys, shared by the login page (which unlocks them) and the cycle app (which uses them).
//
// A random 32-byte master secret is stored in cycle_keys, wrapped (encrypted) with a key made from the login password.
// Two keys are derived from the secret: one encrypts entries (AES-GCM), one turns a date into its day_key (HMAC).
// Only those two are kept on the device, as non-extractable keys in IndexedDB. The password is never stored.

const ITERATIONS = 600000;
const DB_NAME = "hub-cycle";
const STORE = "keys";

const enc = new TextEncoder();
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));

// Device storage ---------------------------------------------------------------------------------
async function withStore(mode, run) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// { userId, entryKey, dayKey } for this user, or null.
export async function loadKeys(userId) {
  const keys = await withStore("readonly", (s) => s.get("current"));
  return keys?.userId === userId ? keys : null;
}
const saveKeys = (keys) => withStore("readwrite", (s) => s.put(keys, "current"));
// Never throws or hangs: signing in and out must work even where storage does not.
export const clearKeys = () => Promise.race([
  withStore("readwrite", (s) => s.delete("current")).catch((e) => console.warn("cycle keys:", e)),
  new Promise((resolve) => setTimeout(resolve, 2000)),
]);

// Wrapping ---------------------------------------------------------------------------------------
async function passwordKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// The cycle_keys columns for a secret. password_wrapped is base64 of: 12-byte IV, then the encrypted secret.
async function wrap(userId, secret, password) {
  const salt = random(16);
  const iv = random(12);
  const key = await passwordKey(password, salt, ITERATIONS);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(userId) }, key, secret));
  return { password_salt: toB64(salt), iterations: ITERATIONS, password_wrapped: toB64([...iv, ...sealed]) };
}

// The secret inside a row. Throws an "OperationError" when the password does not open it.
async function unwrap(userId, row, password) {
  const data = fromB64(row.password_wrapped);
  const key = await passwordKey(password, fromB64(row.password_salt), row.iterations);
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.slice(0, 12), additionalData: enc.encode(userId) }, key, data.slice(12)));
}

async function keep(userId, secret) {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  const derive = (info, type, usages) => crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, base, type, false, usages);
  const entryKey = await derive("cycle/entries/v1", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]);
  const dayKey = await derive("cycle/day-key/v1", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]);
  secret.fill(0);
  await saveKeys({ userId, entryKey, dayKey });
}

// Sign-in ----------------------------------------------------------------------------------------
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const fetchRow = async (sb, userId) => check(await sb.from("cycle_keys").select("*").eq("user_id", userId).maybeSingle());

// Call after a successful sign-in. Creates the keys the first time, otherwise unlocks them.
//   "ready"        keys are on this device
//   "none"         this account does not have the cycle app
//   "old-password" the password has changed: call rewrapKeys with the previous one
export async function setUpKeys(sb, userId, password) {
  const access = check(await sb.from("hub_app_access").select("app_id").eq("app_id", "cycle"));
  if (!access.length) return "none";

  let row = await fetchRow(sb, userId);
  if (!row) {
    const secret = random(32);
    const { error } = await sb.from("cycle_keys").insert({ user_id: userId, ...(await wrap(userId, secret, password)) });
    if (!error) {
      await keep(userId, secret);
      return "ready";
    }
    if (error.code !== "23505") throw new Error(error.message);
    row = await fetchRow(sb, userId); // another device created it just now: unlock that one
  }

  let secret;
  try {
    secret = await unwrap(userId, row, password);
  } catch (e) {
    if (e.name === "OperationError") return "old-password";
    throw e;
  }
  await keep(userId, secret);
  return "ready";
}

// After a password change: open with the old password, lock again with the new one.
// Returns false when the old password is wrong.
export async function rewrapKeys(sb, userId, oldPassword, newPassword) {
  // An earlier try may have updated the row and then failed to save on this device.
  if ((await setUpKeys(sb, userId, newPassword)) !== "old-password") return true;
  const row = await fetchRow(sb, userId);
  let secret;
  try {
    secret = await unwrap(userId, row, oldPassword);
  } catch (e) {
    if (e.name === "OperationError") return false;
    throw e;
  }
  const updated = check(await sb.from("cycle_keys").update(await wrap(userId, secret, newPassword)).eq("user_id", userId).select("user_id"));
  if (!updated.length) throw new Error("cycle_keys was not updated");
  await keep(userId, secret);
  return true;
}
