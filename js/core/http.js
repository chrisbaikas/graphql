/* Shared request budget, including reads of the response body. */
const REQUEST_TIMEOUT_MS = 12_000;
const responseSignals = new WeakMap();

export class TimeoutError extends Error {
  constructor(message = "The request timed out. Please try again.") {
    super(message);
    this.name = "TimeoutError";
  }
}

// Combine cancellation with the timeout; never replace a caller's signal.
// The signal stays attached to the Response, so its body has the same budget.
export async function fetchWithTimeout(url, options = {}, ms = REQUEST_TIMEOUT_MS) {
  const timeout = AbortSignal.timeout(ms);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { ...options, signal });
    responseSignals.set(response, signal);
    return response;
  } catch (err) {
    if (signal.reason?.name === "TimeoutError") throw new TimeoutError();
    throw err;
  }
}

export async function readResponse(response, type = "json") {
  try {
    return await response[type]();
  } catch (err) {
    // A body timeout is distinct from JSON syntax errors and caller aborts.
    if (responseSignals.get(response)?.reason?.name === "TimeoutError" || err?.name === "TimeoutError") {
      throw new TimeoutError();
    }
    throw err;
  }
}
