import test from "node:test";
import assert from "node:assert/strict";
import { login, logout } from "../js/core/auth.js";
import { getToken } from "../js/core/storage.js";
import { newSession } from "../js/core/session.js";
import { fakeDocument, memoryStorage, tokenFor, deferred } from "./helpers.js";

let el;
const signin = (status, body) => ({ ok: status === 200, status, text: async () => body });
test.beforeEach(() => {
  globalThis.sessionStorage = memoryStorage();
  globalThis.localStorage = memoryStorage();
  el = fakeDocument(["username", "password", "login-btn", "error", "login-view", "dashboard-view"]);
  logout();
  el("username").value = "student@example.com";
  el("password").value = "κωδικός🔑";
});
for (const [status, message] of [
  [401, /Invalid credentials/],
  [403, /Invalid credentials/],
  [429, /429/],
  [500, /500/]
]) {
  test(`login status ${status} restores the button and reports the right reason`, async () => {
    globalThis.fetch = async () => signin(status, "");
    await login();
    assert.match(el("error").textContent, message);
    assert.equal(el("login-btn").disabled, false);
    assert.equal(getToken(), null);
  });
}
test("empty credentials are rejected before any request", async () => {
  el("username").value = " ";
  globalThis.fetch = () => assert.fail("must not request");
  await login();
  assert.match(el("error").textContent, /enter your username/);
});
for (const body of [
  "",
  "{}",
  "not-a-jwt",
  `e30.${Buffer.from('{"exp":1}').toString("base64url")}.sig`
]) {
  test(`invalid signin body ${JSON.stringify(body)} is never stored`, async () => {
    globalThis.fetch = async () => signin(200, body);
    await login();
    assert.match(el("error").textContent, /Login failed/);
    assert.equal(getToken(), null);
    assert.equal(el("login-btn").disabled, false);
  });
}
test("network errors and body timeouts remain distinguishable", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await login();
  assert.match(el("error").textContent, /Network error/);
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => {
      throw new DOMException("timeout", "TimeoutError");
    }
  });
  await login();
  assert.match(el("error").textContent, /timed out/);
  assert.equal(el("login-btn").disabled, false);
});
test("logout releases an old login, whose finally cannot unlock a newer attempt", async () => {
  const old = deferred(),
    newer = deferred();
  globalThis.fetch = () => old.promise;
  const pending = login();
  logout();
  el("password").value = "new-fixture";
  globalThis.fetch = () => newer.promise;
  const next = login();
  old.resolve(signin(200, JSON.stringify(tokenFor("old"))));
  await pending;
  assert.equal(getToken(), null);
  assert.equal(el("login-btn").disabled, true);
  newer.resolve(signin(401, ""));
  await next;
  assert.equal(el("login-btn").disabled, false);
  assert.match(el("error").textContent, /Invalid credentials/);
});
test("repeated login while pending sends exactly one request", async () => {
  let calls = 0;
  const result = deferred();
  globalThis.fetch = () => {
    calls++;
    return result.promise;
  };
  const first = login();
  await login();
  assert.equal(calls, 1);
  newSession();
  result.resolve(signin(200, tokenFor("stale")));
  await first;
  assert.equal(getToken(), null);
});
