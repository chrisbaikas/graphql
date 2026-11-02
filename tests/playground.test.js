import test from "node:test";
import assert from "node:assert/strict";
import {
  parseVariables,
  runPlaygroundQuery,
  resetPlayground,
  editIndentation,
  createEditorKeys
} from "../js/playground.js";
import { USER } from "../js/data/queries.js";
import { newSession, registerSessionEnd } from "../js/core/session.js";
import { getToken, setToken, clearToken } from "../js/core/storage.js";
import { fakeDocument, memoryStorage, tokenFor, deferred } from "./helpers.js";
let el;
test.beforeEach(() => {
  newSession();
  globalThis.sessionStorage = memoryStorage();
  globalThis.localStorage = memoryStorage();
  el = fakeDocument(["gql-query", "gql-variables", "gql-result", "gql-status", "gql-run"]);
  resetPlayground();
  setToken(tokenFor());
  registerSessionEnd(() => {
    newSession();
    clearToken();
    resetPlayground();
  });
});
for (const raw of ["null", "[]", "42", '"value"', "{"]) {
  test(`variables ${raw} fail before fetch`, async () => {
    assert.throws(() => parseVariables(raw));
    el("gql-variables").value = raw;
    globalThis.fetch = () => assert.fail("must not request invalid variables");
    await runPlaygroundQuery();
    assert.match(el("gql-status").textContent, /Invalid variables/);
    assert.equal(el("gql-run").disabled, false);
  });
}
test("optional variables are an object", () => {
  assert.deepEqual(parseVariables(""), {});
  assert.deepEqual(parseVariables('{"id":42}'), { id: 42 });
});
test("partial data plus GraphQL errors are displayed as the entire envelope", async () => {
  const envelope = {
    data: { user: null },
    errors: [{ message: "forbidden field", extensions: { code: "access-denied" } }]
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => envelope });
  await runPlaygroundQuery();
  assert.deepEqual(JSON.parse(el("gql-result").textContent), envelope);
  assert.match(el("gql-status").textContent, /1 error/);
  assert.ok(getToken());
});
test("a 403 remains an HTTP authorization failure, preserving the current session", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: "Forbidden" })
  });
  await runPlaygroundQuery();
  assert.match(el("gql-status").textContent, /HTTP 403/);
  assert.match(el("gql-result").textContent, /Forbidden/);
  assert.ok(getToken());
});
test("old playground results and finally cannot affect a newer running query", async () => {
  const old = deferred(),
    next = deferred();
  globalThis.fetch = () => old.promise;
  const first = runPlaygroundQuery();
  newSession();
  resetPlayground();
  setToken(tokenFor("new"));
  globalThis.fetch = () => next.promise;
  const second = runPlaygroundQuery();
  old.resolve({ ok: false, status: 401 });
  await first;
  assert.ok(getToken());
  assert.equal(el("gql-run").disabled, true);
  assert.equal(el("gql-status").textContent, "Running…");
  next.resolve({ ok: true, status: 200, json: async () => ({ data: { user: [] } }) });
  await second;
  assert.equal(el("gql-run").disabled, false);
  assert.deepEqual(JSON.parse(el("gql-result").textContent), { data: { user: [] } });
});
for (const body of [null, {}, [], { errors: [null] }, { errors: "oops" }]) {
  test(`malformed envelope ${JSON.stringify(body)} reports a response failure`, async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => body });
    await runPlaygroundQuery();
    assert.match(el("gql-result").textContent, /invalid GraphQL response/);
    assert.equal(el("gql-run").disabled, false);
  });
}

const MULTILINE_USER = "query User {\n  user {\n    id\n    login\n  }\n}";
test("initial and reset editor content is the multiline User query", () => {
  assert.equal(el("gql-query").value, MULTILINE_USER);
  assert.equal(USER, MULTILINE_USER);
  el("gql-query").value = "query Custom { user { id } }";
  el("gql-variables").value = '{"a":1}';
  resetPlayground();
  assert.equal(el("gql-query").value, MULTILINE_USER);
  assert.equal(el("gql-variables").value, "");
});
test("a session ending resets the editor to the multiline User query", async () => {
  el("gql-query").value = "query Custom { user { id } }";
  setToken("not-a-jwt");
  await runPlaygroundQuery();
  assert.equal(getToken(), null);
  assert.equal(el("gql-query").value, MULTILINE_USER);
});

// ---- editor indentation ----
test("Tab at a caret inserts two spaces and keeps all existing text", () => {
  assert.deepEqual(editIndentation("ab", 1, 1, false), { value: "a  b", start: 3, end: 3 });
  const caret = USER.indexOf("id");
  const edit = editIndentation(USER, caret, caret, false);
  assert.equal(edit.value, USER.slice(0, caret) + "  " + USER.slice(caret));
  assert.equal(edit.start, caret + 2);
  assert.equal(edit.end, caret + 2);
});
test("Shift+Tab removes two spaces from the current line and moves the caret back", () => {
  const caret = USER.indexOf("id");
  const edit = editIndentation(USER, caret, caret, true);
  assert.equal(edit.value, USER.replace("    id", "  id"));
  assert.equal(edit.start, caret - 2);
  assert.equal(edit.end, caret - 2);
});
test("Shift+Tab removes only what is whitespace indentation", () => {
  assert.deepEqual(editIndentation(" x", 2, 2, true), { value: "x", start: 1, end: 1 });
  assert.deepEqual(editIndentation("\tx", 2, 2, true), { value: "x", start: 1, end: 1 });
  // Nothing to remove: text and caret are left exactly alone, even mid-line.
  assert.deepEqual(editIndentation("x  y", 3, 3, true), { value: "x  y", start: 3, end: 3 });
  assert.deepEqual(editIndentation("\nabc", 0, 0, true), { value: "\nabc", start: 0, end: 0 });
  // A caret inside the indentation clamps to the line start.
  assert.deepEqual(editIndentation("  x", 1, 1, true), { value: "x", start: 0, end: 0 });
});
test("Tab and Shift+Tab indent every line a multi-line selection touches", () => {
  assert.deepEqual(editIndentation("a\nb\nc", 0, 5, false), { value: "  a\n  b\n  c", start: 0, end: 11 });
  assert.deepEqual(editIndentation("  a\n b\nc", 0, 8, true), { value: "a\nb\nc", start: 0, end: 5 });
  // Partial lines at both ends still indent whole lines; the selection follows its text.
  assert.deepEqual(editIndentation("abc\ndef", 1, 6, false), { value: "  abc\n  def", start: 3, end: 10 });
});
test("indenting a selection skips empty lines and a line the selection merely ends at", () => {
  assert.deepEqual(editIndentation("a\n\nb", 0, 4, false), { value: "  a\n\n  b", start: 0, end: 8 });
  assert.deepEqual(editIndentation("a\nb\n", 0, 2, false), { value: "  a\nb\n", start: 0, end: 4 });
});
test("a selection within one line indents the line and keeps the same text selected", () => {
  const edit = editIndentation("hello world", 2, 5, false);
  assert.equal(edit.value, "  hello world");
  assert.equal(edit.value.slice(edit.start, edit.end), "llo");
  const back = editIndentation(edit.value, edit.start, edit.end, true);
  assert.equal(back.value, "hello world");
  assert.equal(back.value.slice(back.start, back.end), "llo");
});

// ---- editor keys ----
function editor(value, start = value.length, end = start) {
  return {
    value,
    selectionStart: start,
    selectionEnd: end,
    setSelectionRange(s, e) {
      this.selectionStart = s;
      this.selectionEnd = e;
    }
  };
}
function press(keys, target, key, options = {}) {
  const event = { key, target, prevented: false, ...options, preventDefault() { this.prevented = true; } };
  keys.keydown(event);
  return event;
}
test("Tab indents in the editor, Shift+Tab outdents, and both are handled by the editor", () => {
  const target = editor("  ab", 2);
  const keys = createEditorKeys(() => assert.fail("must not run"));
  assert.equal(press(keys, target, "Tab").prevented, true);
  assert.equal(target.value, "    ab");
  assert.equal(target.selectionStart, 4);
  assert.equal(press(keys, target, "Tab", { shiftKey: true }).prevented, true);
  assert.equal(target.value, "  ab");
  assert.equal(target.selectionStart, 2);
  assert.equal(target.selectionEnd, 2);
});
test("Esc then Tab leaves the editor once, then Tab indents again", () => {
  const target = editor("ab", 1);
  const keys = createEditorKeys(() => {});
  press(keys, target, "Escape");
  const escaped = press(keys, target, "Tab");
  assert.equal(escaped.prevented, false, "the browser is left to move focus");
  assert.equal(target.value, "ab");
  assert.equal(press(keys, target, "Tab").prevented, true);
  assert.equal(target.value, "a  b");
});
test("Esc then Shift+Tab also escapes, and the Shift press does not cancel the Esc", () => {
  const target = editor("ab", 1);
  const keys = createEditorKeys(() => {});
  press(keys, target, "Escape");
  press(keys, target, "Shift", { shiftKey: true });
  assert.equal(press(keys, target, "Tab", { shiftKey: true }).prevented, false);
  assert.equal(target.value, "ab");
});
test("another key, or re-focusing the editor, cancels a pending Esc", () => {
  const target = editor("ab", 1);
  const keys = createEditorKeys(() => {});
  press(keys, target, "Escape");
  press(keys, target, "a");
  assert.equal(press(keys, target, "Tab").prevented, true);
  press(keys, target, "Escape");
  keys.blur();
  assert.equal(press(keys, target, "Tab").prevented, true);
});
test("Ctrl+Tab, Alt+Tab and Cmd+Tab are left to the browser or OS", () => {
  const target = editor("ab", 1);
  const keys = createEditorKeys(() => {});
  for (const mod of ["ctrlKey", "altKey", "metaKey"]) {
    assert.equal(press(keys, target, "Tab", { [mod]: true }).prevented, false);
  }
  assert.equal(target.value, "ab");
});
test("Ctrl+Enter and Cmd+Enter run the query; plain Enter does not", () => {
  const target = editor("q");
  let runs = 0;
  const keys = createEditorKeys(() => runs++);
  assert.equal(press(keys, target, "Enter", { ctrlKey: true }).prevented, true);
  assert.equal(press(keys, target, "Enter", { metaKey: true }).prevented, true);
  assert.equal(runs, 2);
  assert.equal(press(keys, target, "Enter").prevented, false);
  assert.equal(runs, 2);
  assert.equal(target.value, "q");
});
