// The XP figures must match the platform's own profile page, which counts only
// the main cursus. That hinges entirely on every XP query carrying the
// CURSUS_PATH filter — a regression here is silent (the dashboard still renders
// a plausible-looking number, just the wrong one), so pin it here.

import test from "node:test";
import assert from "node:assert/strict";

import { CURSUS_PATH } from "../js/config.js";
import * as QUERIES from "../js/data/queries.js";

const pathFilter = `path: { _like: "${CURSUS_PATH}" }`;

test("CURSUS_PATH is a prefix wildcard, not an exact path", () => {
  assert.ok(CURSUS_PATH.startsWith("/"), "should be an absolute path");
  assert.ok(CURSUS_PATH.endsWith("%"), "should end with the _like wildcard");
  assert.ok(
    !CURSUS_PATH.includes("piscine"),
    "the cursus prefix must not name a piscine"
  );
});

for (const name of ["XP_TRANSACTIONS", "PROJECT_XP", "RECENT_PROJECTS"]) {
  test(`${name} is scoped to the main cursus`, () => {
    assert.ok(
      QUERIES[name].includes(pathFilter),
      `${name} must filter on ${pathFilter} or it will include piscine rows`
    );
  });
}

test("XP queries still filter on type so non-xp rows stay out", () => {
  assert.match(QUERIES.XP_TRANSACTIONS, /type:\s*\{\s*_eq:\s*"xp"\s*\}/);
  assert.match(QUERIES.PROJECT_XP, /type:\s*\{\s*_eq:\s*"xp"\s*\}/);
});

// The audit ratio is deliberately NOT path-scoped: audits are done across the
// whole platform and the platform's own ratio counts all of them.
test("AUDIT_TOTALS is not path-scoped", () => {
  assert.ok(!QUERIES.AUDIT_TOTALS.includes("path:"));
});
