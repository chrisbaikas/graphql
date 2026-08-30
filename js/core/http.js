/* ---------------- FETCH WITH TIMEOUT ---------------- */
//
// `fetch` has no timeout of its own: a platform that accepts the connection and
// then never answers leaves the request pending forever, and with it the
// disabled login button or the dashboard's "Loading…" placeholders.
//
// AbortSignal.timeout() is the native way to bound it — no AbortController to
// wire up and no timer to clear, so nothing leaks if the response arrives first.

export const REQUEST_TIMEOUT_MS = 12_000;

// Thrown when a request ran out of time. A distinct type so callers can report
// "took too long" separately from "could not reach the server" — the two need
// different advice, and collapsing them into one message loses that.
export class TimeoutError extends Error {
  constructor(message = "The request timed out. Please try again.") {
    super(message);
    this.name = "TimeoutError";
  }
}

// Like fetch(), but rejects with TimeoutError after `ms`.
//
// An aborted fetch rejects with a DOMException named "TimeoutError" (from the
// signal) or "AbortError"; both are translated here so callers match on one
// type. Any caller-supplied signal is left untouched — only the timeout is
// added, and a fetch rejection for any other reason passes straight through so
// the existing network-error handling still sees it.
export async function fetchWithTimeout(url, options = {}, ms = REQUEST_TIMEOUT_MS) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
  } catch (err) {
    if (isAbortError(err)) throw new TimeoutError();
    throw err;
  }
}

// True for the DOMException an aborted/timed-out fetch rejects with.
export function isAbortError(err) {
  return Boolean(err) && (err.name === "TimeoutError" || err.name === "AbortError");
}
