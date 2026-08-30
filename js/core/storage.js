/* ---------------- TOKEN STORAGE ---------------- */
//
// The JWT lives in sessionStorage, not localStorage. A localStorage token
// survives closing the browser and is readable by every tab on the origin
// indefinitely; a sessionStorage one is scoped to the tab and is dropped when
// that tab closes, which is the right lifetime for a credential.
//
// Every read/write of the token goes through here, so there is exactly one
// place that knows where it is kept. `sessionStorage` can throw outright in a
// hardened browser (Safari's "block all cookies", some privacy extensions), so
// each access is guarded: a browser that refuses storage lands the user on the
// login view rather than on an uncaught exception.

import { TOKEN_KEY } from "../config.js";

function storage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

// The stored JWT, or null if there is none (or storage is unavailable).
export function getToken() {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

// Persist the JWT for this tab. Returns false when storage refused it, so the
// caller can tell the user instead of showing a dashboard that will not survive
// the next request.
export function setToken(jwt) {
  try {
    storage()?.setItem(TOKEN_KEY, jwt);
    return getToken() === jwt;
  } catch {
    return false;
  }
}

export function clearToken() {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do — a storage that refuses removal holds nothing to remove.
  }
}
