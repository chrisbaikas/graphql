import test from "node:test";
import assert from "node:assert/strict";
import { getToken, setToken, clearToken, clearLegacyToken } from "../js/core/storage.js";
import { memoryStorage } from "./helpers.js";

test.beforeEach(() => {
  globalThis.sessionStorage = memoryStorage();
  globalThis.localStorage = memoryStorage();
});
test("JWT writes only sessionStorage and deletes the legacy localStorage credential", () => {
  localStorage.setItem("token", "legacy-fixture");
  localStorage.setItem("theme", "dark");
  assert.equal(setToken("session-fixture"), true);
  assert.equal(getToken(), "session-fixture");
  assert.equal(localStorage.getItem("token"), null);
  assert.equal(localStorage.getItem("theme"), "dark");
  clearToken();
  assert.equal(getToken(), null);
});
test("startup removes rather than migrates an old credential", () => {
  localStorage.setItem("token", "legacy-fixture");
  clearLegacyToken();
  assert.equal(localStorage.getItem("token"), null);
  assert.equal(getToken(), null);
});
test("storage access errors fail gracefully and do not fall back to localStorage", () => {
  const denied = () => { throw new Error("Storage denied"); };
  globalThis.sessionStorage = { getItem: denied, setItem: denied, removeItem: denied };
  globalThis.localStorage = { removeItem: denied };
  assert.equal(getToken(), null);
  assert.equal(setToken("fixture"), false);
  assert.doesNotThrow(clearToken);
});
