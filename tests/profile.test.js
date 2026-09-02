// These exercise the data layer's transforms by actually RUNNING them against a
// stubbed GraphQL response. The XP queries' own shape is pinned in
// queries.test.js; what is pinned here is the code that consumes the rows.
//
// This file exists because a released bug ("labelForRow is not defined") passed
// both `node --check` and a full test run: every test asserted on query strings
// and on isCursusPath, so no test ever called the function that was missing.
// Asserting a function's shape is not the same as calling it.

import test from "node:test";
import assert from "node:assert/strict";

import { CURSUS_ROOT } from "../js/config.js";

// core/graphql.js reads a JWT from sessionStorage, which does not exist under
// node. Stub the globals it touches before importing the data layer.
globalThis.sessionStorage = {
  _v: {},
  getItem(k) { return this._v[k] ?? null; },
  setItem(k, v) { this._v[k] = String(v); },
  removeItem(k) { delete this._v[k]; }
};

const { fetchXpBreakdown, fetchTotalXp, fetchLevel, clearProfileCache } =
  await import("../js/data/profile.js");

// A JWT that is structurally valid and expires far in the future, so
// graphqlRequest() proceeds to the (stubbed) fetch instead of logging out.
function makeToken() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256" })}.${b64({ exp })}.sig`;
}

// Serve a fixed `transaction` array to whichever query is sent.
function stubTransactions(rowsFor) {
  globalThis.fetch = async (_url, options) => {
    const { query } = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { transaction: rowsFor(query) } })
    };
  };
}

test.beforeEach(() => {
  clearProfileCache();
  sessionStorage.setItem("token", makeToken());
});

test("fetchXpBreakdown labels rows and sorts them newest first", async () => {
  stubTransactions(() => [
    { amount: 1000, createdAt: "2025-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/ascii-art`, object: { name: "ascii-art" } },
    { amount: 2000, createdAt: "2026-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/forum`, object: { name: "forum" } }
  ]);

  const rows = await fetchXpBreakdown();

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.name), ["forum", "ascii-art"]);
  assert.deepEqual(rows.map((r) => r.amount), [2000, 1000]);
});

test("fetchXpBreakdown prefers the object name over the path slug", async () => {
  // The bug this guards: the last path segment is "export-file", which reads as
  // a standalone project rather than part of ascii-art-web.
  stubTransactions(() => [
    { amount: 9200, createdAt: "2025-07-02T00:00:00Z",
      path: `${CURSUS_ROOT}/ascii-art-web/export-file`,
      object: { name: "ascii-art-web-export-file" } }
  ]);

  const [row] = await fetchXpBreakdown();
  assert.equal(row.name, "ascii-art-web-export-file");
});

test("fetchXpBreakdown falls back to the path when no object came back", async () => {
  stubTransactions(() => [
    { amount: 50, createdAt: "2025-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/go-reloaded`, object: null }
  ]);

  const [row] = await fetchXpBreakdown();
  assert.equal(row.name, "Go reloaded");
});

test("fetchXpBreakdown survives a row with neither object nor path", async () => {
  stubTransactions(() => [
    { amount: 50, createdAt: "2025-01-01T00:00:00Z" }
  ]);

  // The row is outside the cursus root, so it is filtered out rather than
  // rendered as "Unknown" — but it must not throw on the way there.
  assert.deepEqual(await fetchXpBreakdown(), []);
});

test("fetchTotalXp counts a piscine roll-up once, not its children", async () => {
  stubTransactions(() => [
    { amount: 390000, createdAt: "2026-06-12T00:00:00Z",
      path: `${CURSUS_ROOT}/piscine-rust`, object: { name: "Piscine Rust" } },
    { amount: 50000, createdAt: "2026-05-01T00:00:00Z",
      path: `${CURSUS_ROOT}/piscine-rust/quest-01/ex-01`, object: null },
    { amount: 16500, createdAt: "2026-07-29T00:00:00Z",
      path: `${CURSUS_ROOT}/exam-2026/safe-sum`, object: { name: "safe-sum" } }
  ]);

  // The exam counts even though its folder name is one the code has never seen;
  // the piscine's child exercise does not.
  assert.equal(await fetchTotalXp(), 390000 + 16500);
});

test("fetchLevel takes the max cursus level, not a piscine's", async () => {
  stubTransactions(() => [
    { amount: 44, path: `${CURSUS_ROOT}/piscine-rust/quest-05` },
    { amount: 31, path: `${CURSUS_ROOT}/real-time-forum` },
    { amount: 24, path: `${CURSUS_ROOT}/forum` }
  ]);

  assert.equal(await fetchLevel(), 31);
});

test("fetchLevel returns null when there are no level rows", async () => {
  stubTransactions(() => []);
  assert.equal(await fetchLevel(), null);
});
