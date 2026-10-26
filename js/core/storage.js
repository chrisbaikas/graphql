/* The JWT is scoped to this browser tab and survives a same-tab refresh. */
import { TOKEN_KEY } from "../config.js";

// Delete the former long-lived credential without ever reading or migrating it.
// Browsers may deny either storage API; failures must not crash login/logout.
export function clearLegacyToken() {
  try { globalThis.localStorage?.removeItem(TOKEN_KEY); } catch { /* Storage denied. */ }
}

export function getToken() {
  try { return globalThis.sessionStorage?.getItem(TOKEN_KEY) ?? null; }
  catch { return null; }
}

export function setToken(jwt) {
  clearLegacyToken();
  try {
    globalThis.sessionStorage?.setItem(TOKEN_KEY, jwt);
    return getToken() === jwt;
  } catch { return false; }
}

export function clearToken() {
  clearLegacyToken();
  try { globalThis.sessionStorage?.removeItem(TOKEN_KEY); }
  catch { /* Storage denied; rendered state is still cleared by logout. */ }
}
