// Shared licence logic (make.js + thanks.html). Lemon Squeezy public licence API, no API key, browser-side.
// First use on a device: activate (gets an instance id). Later: validate that instance. Cached in localStorage.
const C = window.SITE_CONFIG || {};
const KEY = "povmaker.licence";
const API = "https://api.lemonsqueezy.com/v1/licenses/";
const STORE_ID = String(C.lsStoreId || "");
const PRODUCT_ID = String(C.lsProductId || "");
const LIVE = C.mode === "live";

export const stored = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
export const store = (o) => localStorage.setItem(KEY, JSON.stringify(o));
export const clear = () => localStorage.removeItem(KEY);

async function post(path, fields) {
  const r = await fetch(API + path, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
  return r.json().catch(() => ({}));
}
// Only keys from OUR store (and product, if configured); in live mode, never accept test-mode keys.
function ours(d) {
  if (STORE_ID && String(d && d.meta && d.meta.store_id) !== STORE_ID) return false;
  if (PRODUCT_ID && String(d && d.meta && d.meta.product_id) !== PRODUCT_ID) return false;
  if (LIVE && d && d.license_key && d.license_key.test_mode) return false;
  return true;
}
// -> {valid, instance_id?, error?}. Throws on network/CORS failure (callers decide offline grace).
export async function check({ key, instance_id }) {
  if (!key) return { valid: false, error: "Enter a key." };
  if (!instance_id) {
    const a = await post("activate", { license_key: key, instance_name: "web-" + Math.random().toString(36).slice(2, 10) });
    if (!a.activated) return { valid: false, error: a.error || "That key isn't valid, or it's already used on 3 devices." };
    if (!ours(a)) return { valid: false, error: "That key isn't for POVMaker." };
    return { valid: true, instance_id: a.instance && a.instance.id };
  }
  const v = await post("validate", { license_key: key, instance_id });
  const st = v.license_key && v.license_key.status;
  if (v.valid && ours(v) && st !== "expired" && st !== "disabled") return { valid: true, instance_id };
  return { valid: false, error: v.error || "Licence is no longer active." };
}
// Activate a pasted key and remember it. -> {ok, error?}
export async function activate(key) {
  try {
    const r = await check({ key: key.trim() });
    if (!r.valid) return { ok: false, error: r.error || "That key isn't valid." };
    store({ key: key.trim(), instance_id: r.instance_id, checked: Date.now() });
    return { ok: true };
  } catch { return { ok: false, error: "Couldn't reach the licence server. Check your connection and try again." }; }
}
