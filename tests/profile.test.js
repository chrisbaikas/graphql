// Exercise data transformations against stubbed GraphQL responses.
// Query definitions and path-scope rules are covered in queries.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { newSession } from "../js/core/session.js";
import { CURSUS_ROOT } from "../js/config.js";

import { memoryStorage, tokenFor } from "./helpers.js";

globalThis.sessionStorage = memoryStorage();

import {
  fetchXpBreakdown,
  fetchTotalXp,
  fetchLevel,
  fetchProjectXp,
  fetchSkills,
  fetchAuditTotals,
  clearProfileCache
} from "../js/data/profile.js";

// Serve a fixed `transaction` array to whichever query is sent.
function stubTransactions(rowsFor) {
  globalThis.fetch = async (_url, options) => {
    const { query, variables } = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          transaction: rowsFor(query)
            .map((row, i) => ({ id: i + 1, createdAt: "2026-01-01T00:00:00Z", ...row }))
            .slice(variables.offset, variables.offset + variables.limit)
        }
      })
    };
  };
}

test.beforeEach(() => {
  clearProfileCache();
  sessionStorage.setItem("token", tokenFor());
});

test("fetchXpBreakdown labels rows and sorts them newest first", async () => {
  stubTransactions(() => [
    {
      amount: 1000,
      createdAt: "2025-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/ascii-art`,
      object: { name: "ascii-art" }
    },
    {
      amount: 2000,
      createdAt: "2026-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/forum`,
      object: { name: "forum" }
    }
  ]);

  const rows = await fetchXpBreakdown();

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["forum", "ascii-art"]
  );
  assert.deepEqual(
    rows.map((r) => r.amount),
    [2000, 1000]
  );
});

test("fetchXpBreakdown prefers the object name over the path slug", async () => {
  // The bug this guards: the last path segment is "export-file", which reads as
  // a standalone project rather than part of ascii-art-web.
  stubTransactions(() => [
    {
      amount: 9200,
      createdAt: "2025-07-02T00:00:00Z",
      path: `${CURSUS_ROOT}/ascii-art-web/export-file`,
      object: { name: "ascii-art-web-export-file" }
    }
  ]);

  const [row] = await fetchXpBreakdown();
  assert.equal(row.name, "ascii-art-web-export-file");
});

test("fetchXpBreakdown falls back to the path when no object came back", async () => {
  stubTransactions(() => [
    {
      amount: 50,
      createdAt: "2025-01-01T00:00:00Z",
      path: `${CURSUS_ROOT}/go-reloaded`,
      object: null
    }
  ]);

  const [row] = await fetchXpBreakdown();
  assert.equal(row.name, "Go reloaded");
});

test("fetchXpBreakdown survives a row with neither object nor path", async () => {
  stubTransactions(() => [{ amount: 50, createdAt: "2025-01-01T00:00:00Z" }]);

  // The row is outside the cursus root, so it is filtered out rather than
  // rendered as "Unknown" — but it must not throw on the way there.
  assert.deepEqual(await fetchXpBreakdown(), []);
});

test("fetchTotalXp counts a piscine roll-up once, not its children", async () => {
  stubTransactions(() => [
    {
      amount: 390000,
      createdAt: "2026-06-12T00:00:00Z",
      path: `${CURSUS_ROOT}/piscine-rust`,
      object: { name: "Piscine Rust" }
    },
    {
      amount: 50000,
      createdAt: "2026-05-01T00:00:00Z",
      path: `${CURSUS_ROOT}/piscine-rust/quest-01/ex-01`,
      object: null
    },
    {
      amount: 16500,
      createdAt: "2026-07-29T00:00:00Z",
      path: `${CURSUS_ROOT}/exam-2026/safe-sum`,
      object: { name: "safe-sum" }
    }
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

test("project XP groups by object ID while preserving duplicate display names", async () => {
  stubTransactions(() => [
    { amount: 100, path: `${CURSUS_ROOT}/a`, object: { id: 1, name: "Same" } },
    { amount: 50, path: `${CURSUS_ROOT}/a`, object: { id: 1, name: "Same" } },
    { amount: 200, path: `${CURSUS_ROOT}/b`, object: { id: 2, name: "Same" } },
    { amount: 70, path: `${CURSUS_ROOT}/c`, objectId: 3, object: null },
    { amount: 900, path: `${CURSUS_ROOT}/piscine-rust/quest-01`, objectId: 4 }
  ]);
  assert.deepEqual(await fetchProjectXp(), [
    { name: "Same", amount: 200 },
    { name: "Same", amount: 150 },
    { name: "C", amount: 70 }
  ]);
});

test("shared XP consumers reuse one paginated request sequence until the cache is cleared", async () => {
  let requests = 0;
  stubTransactions(() => {
    requests++;
    return [{ amount: 100, path: `${CURSUS_ROOT}/forum`, createdAt: "2026-01-01T00:00:00Z" }];
  });
  await Promise.all([fetchTotalXp(), fetchXpBreakdown()]);
  assert.equal(requests, 2);
  clearProfileCache();
  await fetchTotalXp();
  assert.equal(requests, 4);
});

test("skills use each type's highest amount rather than summing improvements", async () => {
  stubTransactions(() => [
    { type: "skill_go", amount: 75 },
    { type: "skill_js", amount: 60 },
    { type: "skill_go", amount: 30 }
  ]);
  assert.deepEqual(await fetchSkills(), [
    { name: "Go", amount: 75 },
    { name: "Js", amount: 60 }
  ]);
});

test("audit totals add each transaction only to its own direction", async () => {
  stubTransactions(() => [
    { type: "up", amount: 100 },
    { type: "up", amount: 50 },
    { type: "down", amount: 200 }
  ]);
  assert.deepEqual(await fetchAuditTotals(), { done: 150, received: 200 });
});

test("pagination continues across short server-capped pages, with stable offsets", async () => {
  const offsets = [];
  globalThis.fetch = async (_url, options) => {
    const { variables } = JSON.parse(options.body);
    offsets.push(variables.offset);
    const rows = [1, 2, 3].slice(variables.offset, variables.offset + 1).map((id) => ({
      id,
      amount: id * 100,
      path: `${CURSUS_ROOT}/p${id}`,
      createdAt: "2026-01-01T00:00:00Z"
    }));
    return { ok: true, status: 200, json: async () => ({ data: { transaction: rows } }) };
  };
  assert.equal(await fetchTotalXp(), 600);
  assert.deepEqual(offsets, [0, 1, 2, 3]);
});
test("missing row arrays and nonnumeric amounts cannot silently become zero totals", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) });
  await assert.rejects(fetchTotalXp(), /Invalid transaction data/);
  clearProfileCache();
  stubTransactions(() => [{ amount: "100", path: `${CURSUS_ROOT}/forum` }]);
  await assert.rejects(fetchTotalXp(), /Invalid transaction amount/);
});
test("invalid dates are reported before rendering an SVG with NaN coordinates", async () => {
  stubTransactions(() => [{ amount: 100, path: `${CURSUS_ROOT}/forum`, createdAt: "invalid" }]);
  await assert.rejects(fetchTotalXp(), /Invalid XP date/);
});
test("a rejected promise is evicted so retry can succeed", async () => {
  stubTransactions(() => {
    throw new Error("fixture outage");
  });
  await assert.rejects(fetchTotalXp());
  stubTransactions(() => [{ amount: 123, path: `${CURSUS_ROOT}/forum` }]);
  assert.equal(await fetchTotalXp(), 123);
});
test("XP card, line and grouped bars share one complete snapshot", async () => {
  let requests = 0;
  stubTransactions(() => {
    requests++;
    return [
      { amount: 123, path: `${CURSUS_ROOT}/forum`, objectId: 1, object: { id: 1, name: "forum" } }
    ];
  });
  const [total, projects] = await Promise.all([fetchTotalXp(), fetchProjectXp()]);
  assert.equal(total, 123);
  assert.deepEqual(projects, [{ name: "forum", amount: 123 }]);
  assert.equal(requests, 2); // one data page and one terminal empty page
});
test("a repeated stable row ID rejects instead of double-counting an ignored offset", async () => {
  stubTransactions(() => [
    { id: 1, amount: 123, path: `${CURSUS_ROOT}/forum` },
    { id: 1, amount: 123, path: `${CURSUS_ROOT}/forum` }
  ]);
  await assert.rejects(fetchTotalXp(), /data changed/);
});

test("a generation change invalidates resolved data even without an explicit cache clear", async () => {
  let requests = 0;
  stubTransactions(() => {
    requests++;
    return [{ amount: 123, path: `${CURSUS_ROOT}/forum` }];
  });
  await fetchTotalXp();
  newSession();
  await fetchTotalXp();
  assert.equal(requests, 4);
});
test("null amounts contribute zero without producing NaN", async () => {
  stubTransactions(() => [{ amount: null, path: `${CURSUS_ROOT}/forum` }]);
  assert.equal(await fetchTotalXp(), 0);
});

for (const id of ["1", 1.5]) {
  test(`pagination rejects non-integer row ID ${JSON.stringify(id)}`, async () => {
    stubTransactions(() => [{ id, amount: 100, path: `${CURSUS_ROOT}/forum` }]);
    await assert.rejects(fetchTotalXp(), /Invalid row ID/);
  });
}

for (const [type, fetchData] of [
  ["skill_go", fetchSkills],
  ["up", fetchAuditTotals]
]) {
  test(`${type} amounts are not silently coerced from strings`, async () => {
    stubTransactions(() => [{ type, amount: "75" }]);
    await assert.rejects(fetchData(), /Invalid transaction amount/);
  });
}
