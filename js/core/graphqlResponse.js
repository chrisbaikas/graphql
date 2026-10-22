/* Shared envelope rules; the playground still displays the complete response. */
export function isGraphqlEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if ("errors" in value) {
    if (!Array.isArray(value.errors)) return false;
    if (value.errors.some((error) => !error || typeof error.message !== "string")) return false;
  }
  const hasData = Boolean(value.data) && typeof value.data === "object" && !Array.isArray(value.data);
  const hasErrors = Boolean(value.errors?.length);
  return hasData || hasErrors;
}

export function graphqlErrorMessage(value) {
  if (Array.isArray(value?.errors)) {
    return value.errors.map((error) => typeof error?.message === "string" ? error.message : "")
      .filter(Boolean).join("; ");
  }
  return typeof value?.message === "string" ? value.message : "";
}

export function hasSessionError(value) {
  return Array.isArray(value?.errors) && value.errors.some((error) => {
    const code = error?.extensions?.code;
    if (code) return ["invalid-jwt", "jwt-invalid-claims", "jwt-missing-role-claims"].includes(code);
    // Permission/validation failures (including fields named token/JWT) must
    // not destroy a usable session. Only explicit credential failures do.
    return /\b(?:jwt|token)\b.*\b(?:expired|invalid|revoked|verification|malformed)\b|\b(?:expired|invalid|revoked|malformed)\s+(?:jwt|token)\b|could not verify jwt/i
      .test(error?.message || "");
  });
}
