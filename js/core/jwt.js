/* Decode only; the platform verifies the signature and access permissions. */
export function decodeJwtPayload(jwt) {
  try {
    if (typeof jwt !== "string") return null;
    const parts = jwt.split(".");
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch { return null; }
}

export function isTokenExpired(jwt) {
  const payload = decodeJwtPayload(jwt);
  return !payload || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000;
}
