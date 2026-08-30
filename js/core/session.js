/* ---------------- SESSION REGISTRY ---------------- */

// `graphqlRequest()` must be able to end the session when the platform rejects
// a token, and `auth.js` must be able to reach the UI to reset it. Importing
// each other directly would make a cycle (graphql -> auth -> ui -> ... ), so
// the session-ending callback is registered here once at start-up by main.js
// and both sides depend only on this tiny module.
let onSessionEnd = () => {};

export function registerSessionEnd(fn) {
  onSessionEnd = fn;
}

// Call the registered logout. Safe to call before registration (no-op).
export function endSession() {
  onSessionEnd();
}

// A session-ending error whose message may be empty: the first concurrent
// caller carries the text, the rest are silent so they don't overwrite it.
export class SilentError extends Error {}
