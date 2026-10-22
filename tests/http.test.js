// The fetch-timeout wrapper. `fetch` is stubbed on globalThis so these run
// without touching the network.

import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchWithTimeout,
  readResponse,
  TimeoutError
} from "../js/core/http.js";

// Swap in a stub fetch for one call and always put the real one back.
async function withFetch(stub, run) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("a response that arrives in time is returned untouched", async () => {
  const response = { ok: true, status: 200 };
  const result = await withFetch(
    async () => response,
    () => fetchWithTimeout("https://example.test/")
  );
  assert.equal(result, response);
});

test("an abort signal is attached and the caller's options are preserved", async () => {
  let seen;
  await withFetch(
    async (_url, options) => {
      seen = options;
      return { ok: true };
    },
    () =>
      fetchWithTimeout("https://example.test/", {
        method: "POST",
        headers: { Authorization: "Bearer x" }
      })
  );

  assert.equal(seen.method, "POST");
  assert.equal(seen.headers.Authorization, "Bearer x");
  assert.ok(seen.signal, "a timeout signal should be attached");
  assert.equal(seen.signal.aborted, false);
});

test("a timed-out request rejects with TimeoutError", async () => {
  // A 5ms budget against a fetch that never settles until aborted.
  await withFetch(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(options.signal.reason)
        );
      }),
    async () => {
      await assert.rejects(
        () => fetchWithTimeout("https://example.test/", {}, 5),
        (err) => {
          assert.ok(err instanceof TimeoutError);
          assert.match(err.message, /timed out/i);
          return true;
        }
      );
    }
  );
});

test("a network failure is passed through, not relabelled as a timeout", async () => {
  // The distinction matters: callers report "could not reach the server" for
  // this and "took too long" for a timeout, and the two need different advice.
  const networkError = new TypeError("Failed to fetch");
  await withFetch(
    async () => {
      throw networkError;
    },
    async () => {
      await assert.rejects(
        () => fetchWithTimeout("https://example.test/"),
        (err) => {
          assert.equal(err, networkError);
          assert.ok(!(err instanceof TimeoutError));
          return true;
        }
      );
    }
  );
});

test("caller cancellation is preserved and is not reported as a timeout", async () => {
  const controller = new AbortController();
  await withFetch((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason));
  }), async () => {
    const pending = fetchWithTimeout("https://example.test/", {signal:controller.signal});
    controller.abort();
    await assert.rejects(pending, (err) => err.name === "AbortError" && !(err instanceof TimeoutError));
  });
});

test("the request budget still applies after response headers arrive", async () => {
  await withFetch(async (_url, options) => ({
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Body aborted", "AbortError")));
    })
  }), async () => {
    const keepAlive = setInterval(() => {}, 50);
    try {
      const response = await fetchWithTimeout("https://example.test/", {}, 5);
      await assert.rejects(readResponse(response), TimeoutError);
    } finally { clearInterval(keepAlive); }
  });
});
