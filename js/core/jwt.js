/* ---------------- JWT HELPERS ---------------- */

// Decode the JWT payload (middle segment, base64url) without verifying it —
// just enough to read the `exp` claim for client-side expiry checks.
export function decodeJwtPayload(jwt) {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// True if the token is malformed or its `exp` (seconds) is in the past.
export function isTokenExpired(jwt) {
  const payload = decodeJwtPayload(jwt);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 <= Date.now();
}
