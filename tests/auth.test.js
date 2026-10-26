// Authentication helpers: building the Basic credential and cleaning the JWT
// the signin endpoint hands back.

import test from "node:test";
import assert from "node:assert/strict";

import { basicAuth, cleanToken } from "../js/core/auth.js";

// What the credential should decode back to, as bytes.
function decodeBasic(credential) {
  return Buffer.from(credential, "base64").toString("utf8");
}

test("basicAuth: ASCII credentials match plain base64 of identifier:password", () => {
  const credential = basicAuth("student", "hunter2");
  assert.equal(credential, Buffer.from("student:hunter2").toString("base64"));
  assert.equal(decodeBasic(credential), "student:hunter2");
});

test("basicAuth: works with an email identifier as well as a username", () => {
  const credential = basicAuth("student@example.com", "hunter2");
  assert.equal(decodeBasic(credential), "student@example.com:hunter2");
});

test("basicAuth: Greek characters survive as UTF-8", () => {
  // The reason this helper exists rather than a bare btoa(): btoa() only
  // accepts Latin-1 and throws an InvalidCharacterError on anything above
  // U+00FF, so a Greek password would break login outright.
  const credential = basicAuth("χρήστης", "κωδικός123");
  assert.equal(decodeBasic(credential), "χρήστης:κωδικός123");
});

test("basicAuth: accented and emoji characters survive as UTF-8", () => {
  assert.equal(decodeBasic(basicAuth("josé", "naïve-café")), "josé:naïve-café");
  assert.equal(decodeBasic(basicAuth("user", "pa55w🔑rd")), "user:pa55w🔑rd");
});

test("basicAuth: the encoding is byte-for-byte UTF-8, not Latin-1", () => {
  // "ή" is U+03AE — two bytes in UTF-8 (0xCE 0xAE). A Latin-1 encoding would
  // produce a different, shorter string, and the platform would reject it.
  const credential = basicAuth("a", "ή");
  assert.deepEqual(
    [...Buffer.from(credential, "base64")],
    [0x61, 0x3a, 0xce, 0xae] // 'a' ':' then the two UTF-8 bytes
  );
});

test("basicAuth: a colon in the password is not ambiguous", () => {
  // Basic auth splits on the FIRST colon, so a password containing one is
  // still transmitted intact.
  const credential = basicAuth("student", "a:b:c");
  const decoded = decodeBasic(credential);
  assert.equal(decoded, "student:a:b:c");
});

test("basicAuth: empty password still produces a valid credential", () => {
  assert.equal(decodeBasic(basicAuth("student", "")), "student:");
});

test("cleanToken: strips the quotes the signin endpoint wraps the JWT in", () => {
  assert.equal(cleanToken('"eyJhbGciOi.payload.sig"'), "eyJhbGciOi.payload.sig");
});

test("cleanToken: strips surrounding whitespace and newlines", () => {
  assert.equal(cleanToken("  eyJ.payload.sig\n"), "eyJ.payload.sig");
  assert.equal(cleanToken('\n\t"eyJ.payload.sig"\r\n '), "eyJ.payload.sig");
});

test("cleanToken: handles whitespace inside the quotes too", () => {
  assert.equal(cleanToken('" eyJ.payload.sig "'), "eyJ.payload.sig");
});

test("cleanToken: repeated quotes are all removed", () => {
  assert.equal(cleanToken('""eyJ.payload.sig""'), "eyJ.payload.sig");
});

test("cleanToken: a bare token passes through unchanged", () => {
  assert.equal(cleanToken("eyJ.payload.sig"), "eyJ.payload.sig");
});

test("cleanToken: an empty or whitespace-only body yields an empty string", () => {
  // login() checks for this and reports "no token returned by the server"
  // rather than storing an empty credential.
  assert.equal(cleanToken(""), "");
  assert.equal(cleanToken("   \n "), "");
  assert.equal(cleanToken('""'), "");
});

test("cleanToken: quotes inside the token are left alone", () => {
  // Only the surrounding pair is stripped — an interior character is part of
  // the value, whatever it is.
  assert.equal(cleanToken('"ey"J.sig"'), 'ey"J.sig');
});
