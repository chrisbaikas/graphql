// JWT helpers. The app never verifies a signature — it only reads `exp` to
// decide whether a stored token is worth sending — so these tests build tokens
// by hand rather than signing anything.

import test from "node:test";
import assert from "node:assert/strict";

import { decodeJwtPayload, isTokenExpired } from "../js/core/jwt.js";

// Encode a payload the way a real JWT does: base64url, no padding.
function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// A token with the given payload. Header and signature are placeholders: the
// helpers only ever look at the middle segment.
function tokenWith(payload) {
  return `header.${base64url(payload)}.signature`;
}

const HOUR = 3600;
const nowSeconds = () => Math.floor(Date.now() / 1000);

test("decodeJwtPayload: reads the middle segment", () => {
  const payload = { sub: "42", login: "student", exp: nowSeconds() + HOUR };
  assert.deepEqual(decodeJwtPayload(tokenWith(payload)), payload);
});

test("decodeJwtPayload: handles base64url's - and _ substitutions", () => {
  // A payload chosen so its base64 contains both '+' and '/', which base64url
  // writes as '-' and '_'. Decoding must translate them back or JSON.parse
  // fails on the garbage that comes out of atob().
  const payload = { data: "??>>??>>", exp: nowSeconds() + HOUR };
  const encoded = base64url(payload);
  assert.ok(
    encoded.includes("-") || encoded.includes("_"),
    "fixture should exercise the base64url character set"
  );
  assert.deepEqual(decodeJwtPayload(tokenWith(payload)), payload);
});

test("decodeJwtPayload: malformed input returns null instead of throwing", () => {
  assert.equal(decodeJwtPayload(""), null);
  assert.equal(decodeJwtPayload("not-a-jwt"), null);
  assert.equal(decodeJwtPayload("header.only"), null);
  assert.equal(decodeJwtPayload("header..signature"), null);
  assert.equal(decodeJwtPayload("header.!!!not-base64!!!.signature"), null);
  // Valid base64 whose contents are not JSON.
  assert.equal(
    decodeJwtPayload(`header.${Buffer.from("plain text").toString("base64")}.sig`),
    null
  );
});

test("isTokenExpired: false for a token with a future exp", () => {
  assert.equal(isTokenExpired(tokenWith({ exp: nowSeconds() + HOUR })), false);
});

test("isTokenExpired: true for a token whose exp has passed", () => {
  assert.equal(isTokenExpired(tokenWith({ exp: nowSeconds() - HOUR })), true);
});

test("isTokenExpired: treats anything unreadable as expired", () => {
  // Failing closed matters here: an unreadable token must send the user to the
  // login view, never be sent to the platform as though it were good.
  assert.equal(isTokenExpired("not-a-jwt"), true);
  assert.equal(isTokenExpired(""), true);
  assert.equal(isTokenExpired(tokenWith({ sub: "42" })), true); // no exp at all
  assert.equal(isTokenExpired(tokenWith({ exp: "soon" })), true); // exp not a number
  assert.equal(isTokenExpired(tokenWith({ exp: null })), true);
});

test("isTokenExpired: exp is read as seconds, not milliseconds", () => {
  // A token expiring in an hour, written in seconds as the spec requires. If
  // the helper compared it against Date.now() in milliseconds it would read as
  // long expired, and every login would immediately bounce back to the form.
  assert.equal(isTokenExpired(tokenWith({ exp: nowSeconds() + HOUR })), false);
  // The same number misread as milliseconds would be far in the past.
  assert.equal(isTokenExpired(tokenWith({ exp: 1 })), true);
});
