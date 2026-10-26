// The XP figures must match the platform's own XP board. That board counts a
// Piscine ONCE, as a rolled-up total, and ignores the hundreds of child rows
// underneath it — so the rule is about path depth, not a path prefix. A
// regression here is silent: the dashboard still renders a plausible-looking
// number, just the wrong one. Pin both the rule and the queries that feed it.

import test from "node:test";
import assert from "node:assert/strict";

import { CURSUS_ROOT } from "../js/config.js";
import { isCursusPath } from "../js/data/profile.js";
import * as QUERIES from "../js/data/queries.js";

test("CURSUS_ROOT is a bare root with no trailing slash or wildcard", () => {
  assert.ok(CURSUS_ROOT.startsWith("/"));
  assert.ok(!CURSUS_ROOT.endsWith("/"));
  assert.ok(!CURSUS_ROOT.includes("%"));
});

test("isCursusPath keeps a project directly under the cursus root", () => {
  assert.equal(isCursusPath(`${CURSUS_ROOT}/ascii-art`), true);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/real-time-forum`), true);
});

test("isCursusPath keeps a Piscine's rolled-up total", () => {
  // "Piscine Rust — 390 kB" is one row on the platform's board, and counts.
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine-rust`), true);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine-js`), true);
});

test("isCursusPath drops the exercises inside a Piscine", () => {
  // These are what double-count the Piscine if summed alongside the roll-up.
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine-rust/quest-01`), false);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine-go/quest-01/ex-03`), false);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine-data-ai/w1/d2/ex`), false);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscine/quest-01`), false);
});

// "piscine-rust" is a Piscine; a project merely starting with those letters is
// not, and must not be swept up with it.
test("isCursusPath matches a Piscine segment, not any name containing it", () => {
  assert.equal(isCursusPath(`${CURSUS_ROOT}/piscined-thing/ex`), true);
  assert.equal(isCursusPath(`${CURSUS_ROOT}/my-piscine-notes/ex`), true);
});

// Exam folders vary across years, so their names must not restrict XP scope.
test("isCursusPath keeps exam exercises whatever the folder is named", () => {
  for (const folder of ["checkpoint", "checkpoints", "exam", "tests", "2026"]) {
    assert.equal(isCursusPath(`${CURSUS_ROOT}/${folder}/safe-sum`), true, folder);
  }
  assert.equal(isCursusPath(`${CURSUS_ROOT}/a/b/c/validate-stack`), true);
});

test("isCursusPath drops anything outside the cursus root", () => {
  assert.equal(isCursusPath("/athens/piscine-go/quest-01"), false);
  assert.equal(isCursusPath("/other-campus/div-01/ascii-art"), false);
  // A sibling root that merely shares the prefix must not slip through.
  assert.equal(isCursusPath(`${CURSUS_ROOT}-archive/ascii-art`), false);
});

test("isCursusPath tolerates a missing or non-string path", () => {
  for (const value of [undefined, null, 0, {}, []]) {
    assert.equal(isCursusPath(value), false);
  }
  assert.equal(isCursusPath(CURSUS_ROOT), false);
});

// The rolled-up Piscine rows and the exam exercises both live outside a plain
// "projects only" filter, so the queries must NOT narrow to project objects —
// doing so would silently drop 460 kB of Piscine XP and every exam row.
test("XP query fetches path and does not filter to project objects", () => {
  const query = QUERIES.XP_TRANSACTIONS;
  assert.match(query, /type:\s*\{\s*_eq:\s*"xp"\s*\}/);
  assert.ok(query.includes(`path: { _like: "${CURSUS_ROOT}/%" }`));
  assert.match(query, /^\s*path\s*$/m, "XP must select path");
  assert.ok(!query.includes('object: { type: { _eq: "project" } }'),
    "XP must not drop piscine roll-ups and exam rows");
});

// The level track is per-event too: a Piscine levels independently of the
// cursus, so an unscoped max would report a Piscine level as the cursus one.
test("LEVEL is scoped to the cursus root and selects path", () => {
  const query = QUERIES.LEVEL;
  assert.match(query, /type:\s*\{\s*_eq:\s*"level"\s*\}/);
  assert.ok(query.includes(`path: { _like: "${CURSUS_ROOT}/%" }`));
  assert.match(query, /^\s*path\s*$/m, "LEVEL must select path");
  // A server-side limit would pick a row before the depth filter runs and
  // could hand back a piscine level.
  assert.ok(!/limit:\s*1\b/.test(query), "LEVEL must not choose only one row before filtering");
  assert.match(query, /offset: \$offset/);
});

// The audit ratio is deliberately NOT path-scoped: audits are done across the
// whole platform and the platform's own ratio counts all of them.
test("AUDIT_TOTALS is not path-scoped", () => {
  assert.ok(!QUERIES.AUDIT_TOTALS.includes("path:"));
});
