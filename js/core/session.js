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
export function endSession(message = "") {
  onSessionEnd(message);
}

// Discarded requests use an empty message. Session-ending explanations are
// delivered by the registered hook after the UI has been reset.
export class SilentError extends Error {}

/* ---------------- SESSION GENERATION ---------------- */
//
// Every dashboard load and every logout starts a new generation. Async loaders
// capture the generation they began in and check it again after each await: a
// response that arrives after a logout (or after a newer load started) belongs
// to a session that no longer exists, so it must not be written to the DOM.
//
// Without this, a slow request issued by user A can resolve while user B is
// looking at the dashboard and paint A's data over B's.
let generation = 0;
let controller = new AbortController();

export function sessionSignal() {
  return controller.signal;
}

// Invalidate old loaders and cancel their requests before starting a new load.
export function newSession() {
  generation += 1;
  controller.abort();
  controller = new AbortController();
  return generation;
}

// The generation a loader should capture when it starts.
export function currentSession() {
  return generation;
}

// True while `id` is still the live generation.
export function isCurrentSession(id) {
  return id === generation;
}
