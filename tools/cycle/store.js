// Cycle entries: encrypted on this device, kept in memory by date. The server only ever sees
// user_id, day_key (an HMAC of the date), iv, ciphertext and updated_at.

const PAGE = 1000; // Supabase's default row limit per request

const enc = new TextEncoder();
const toB64 = (bytes) => btoa(Array.from(new Uint8Array(bytes), (b) => String.fromCharCode(b)).join(""));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export function createStore(sb, { userId, entryKey, dayKey }) {
  const entries = new Map(); // date -> entry (the plaintext object, unknown fields included)
  const versions = new Map(); // day_key -> updated_at of the row last seen
  const unreadable = new Set(); // day_keys whose row did not decrypt: never written over

  const keyOf = async (date) => toB64(await crypto.subtle.sign("HMAC", dayKey, enc.encode(date)));
  // Ties a ciphertext to its owner and day, so rows cannot be swapped around.
  const bound = (dk) => enc.encode(`${userId}|${dk}`);
  const table = () => sb.from("cycle_entries");

  async function read(row) {
    versions.set(row.day_key, row.updated_at);
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(row.iv), additionalData: bound(row.day_key) }, entryKey, fromB64(row.ciphertext));
      const entry = JSON.parse(new TextDecoder().decode(plain));
      entries.set(entry.date, entry);
      unreadable.delete(row.day_key);
    } catch {
      unreadable.add(row.day_key);
    }
  }

  // Loads everything. Returns how many rows could not be read.
  async function load() {
    for (let from = 0; ; from += PAGE) {
      const rows = check(await table().select("day_key, iv, ciphertext, updated_at").order("day_key").range(from, from + PAGE - 1));
      for (const row of rows) await read(row);
      if (rows.length < PAGE) return unreadable.size;
    }
  }

  // The day's row as the server has it now. True if it differs from what was last seen here.
  async function refresh(date, dk) {
    const row = check(await table().select("day_key, iv, ciphertext, updated_at").eq("day_key", dk).maybeSingle());
    if (!row) {
      const had = versions.delete(dk);
      entries.delete(date);
      unreadable.delete(dk);
      return had;
    }
    // Compared as times: the server writes the same instant in a different format.
    const same = versions.has(dk) && Date.parse(versions.get(dk)) === Date.parse(row.updated_at);
    await read(row);
    return !same;
  }

  // "saved", or "changed" when another device changed this day first (nothing is written then).
  async function save(date, fields) {
    const dk = await keyOf(date);
    const changed = await refresh(date, dk);
    if (unreadable.has(dk)) throw new Error("unreadable");
    if (changed) return "changed";
    const entry = { ...entries.get(date), v: 1, date, ...fields }; // keeps fields this version does not know
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bound(dk) }, entryKey, enc.encode(JSON.stringify(entry)));
    const updated_at = new Date().toISOString();
    check(await table().upsert({ user_id: userId, day_key: dk, iv: toB64(iv), ciphertext: toB64(sealed), updated_at },
      { onConflict: "user_id,day_key" }));
    entries.set(date, entry);
    versions.set(dk, updated_at);
    return "saved";
  }

  async function remove(date) {
    const dk = await keyOf(date);
    check(await table().delete().eq("day_key", dk));
    entries.delete(date);
    versions.delete(dk);
  }

  return {
    entries,
    load,
    save,
    remove,
    isUnreadable: async (date) => unreadable.has(await keyOf(date)),
  };
}
