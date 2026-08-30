// Formatting helpers. Pure functions, no DOM — they import and run in Node
// exactly as they do in the browser.

import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDate,
  formatSkillName,
  formatXp,
  truncate
} from "../js/ui/format.js";

test("formatXp: bytes below 1 kB stay as bytes", () => {
  assert.equal(formatXp(0), "0 B");
  assert.equal(formatXp(1), "1 B");
  assert.equal(formatXp(999), "999 B");
});

test("formatXp: kB from 1 000, MB from 1 000 000", () => {
  // The platform counts in decimal units, not 1024s — 1000 B is 1.00 kB.
  assert.equal(formatXp(1_000), "1.00 kB");
  assert.equal(formatXp(1_500), "1.50 kB");
  assert.equal(formatXp(999_999), "1000.00 kB");
  assert.equal(formatXp(1_000_000), "1.00 MB");
  assert.equal(formatXp(2_345_678), "2.35 MB");
});

test("formatDate: fixed DD/MM/YYYY regardless of host locale", () => {
  // A US-locale runner would render this 03/07/2021 with toLocaleDateString;
  // the point of the helper is that it does not.
  const ms = Date.UTC(2021, 6, 3, 12, 0, 0); // 3 July 2021, midday UTC
  assert.equal(formatDate(ms), "03/07/2021");
});

test("formatDate: pads single-digit days and months", () => {
  assert.equal(formatDate(Date.UTC(2024, 0, 5, 12)), "05/01/2024");
  assert.equal(formatDate(Date.UTC(2024, 10, 25, 12)), "25/11/2024");
});

test("formatSkillName: strips the skill_ prefix and capitalises", () => {
  assert.equal(formatSkillName("skill_go"), "Go");
  assert.equal(formatSkillName("skill_prog"), "Prog");
});

test("formatSkillName: separators become spaces", () => {
  assert.equal(formatSkillName("skill_web-dev"), "Web dev");
  assert.equal(formatSkillName("skill_back_end"), "Back end");
  assert.equal(formatSkillName("skill_sys--admin"), "Sys admin");
});

test("formatSkillName: a type with nothing left after stripping is returned as-is", () => {
  // Rather than rendering an empty label in the skills list.
  assert.equal(formatSkillName("skill_"), "skill_");
});

test("formatSkillName: a type without the prefix is still tidied", () => {
  assert.equal(formatSkillName("go"), "Go");
});

test("truncate: text at or under the limit is untouched", () => {
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("exactlyten", 10), "exactlyten");
});

test("truncate: longer text is cut and ellipsised to exactly `max` characters", () => {
  const out = truncate("a-very-long-project-name", 10);
  assert.equal(out, "a-very-lo…");
  // The ellipsis counts towards the budget — the label must not overrun the
  // SVG gutter it was measured for.
  assert.equal(out.length, 10);
});

test("truncate: non-string input is coerced rather than throwing", () => {
  assert.equal(truncate(1234567, 4), "123…");
});
