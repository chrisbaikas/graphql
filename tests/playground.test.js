import test from "node:test";
import assert from "node:assert/strict";
import { parseVariables, runPlaygroundQuery, resetPlayground } from "../js/playground.js";
import { newSession, registerSessionEnd } from "../js/core/session.js";
import { getToken, setToken, clearToken } from "../js/core/storage.js";
import { fakeDocument, memoryStorage, tokenFor, deferred } from "./helpers.js";
let el;
test.beforeEach(() => {
  newSession();
  globalThis.sessionStorage = memoryStorage();
  globalThis.localStorage = memoryStorage();
  el = fakeDocument(["gql-query","gql-variables","gql-result","gql-status","gql-run"]);
  resetPlayground(); setToken(tokenFor());
  registerSessionEnd(() => { newSession(); clearToken(); resetPlayground(); });
});
for (const raw of ["null","[]","42",'"value"',"{"]) {
  test(`variables ${raw} fail before fetch`, async () => {
    assert.throws(() => parseVariables(raw));
    el("gql-variables").value = raw;
    globalThis.fetch = () => assert.fail("must not request invalid variables");
    await runPlaygroundQuery();
    assert.match(el("gql-status").textContent,/Invalid variables/);
    assert.equal(el("gql-run").disabled,false);
  });
}
test("optional variables are an object", () => {
  assert.deepEqual(parseVariables(""),{});
  assert.deepEqual(parseVariables('{"id":42}'),{id:42});
});
test("partial data plus GraphQL errors are displayed as the entire envelope", async () => {
  const envelope = {data:{user:null},errors:[{message:"forbidden field",extensions:{code:"access-denied"}}]};
  globalThis.fetch = async () => ({ok:true,status:200,json:async()=>envelope});
  await runPlaygroundQuery();
  assert.deepEqual(JSON.parse(el("gql-result").textContent),envelope);
  assert.match(el("gql-status").textContent,/1 error/);
  assert.ok(getToken());
});
test("a 403 remains an HTTP authorization failure, preserving the current session", async () => {
  globalThis.fetch = async () => ({ok:false,status:403,json:async()=>({message:"Forbidden"})});
  await runPlaygroundQuery();
  assert.match(el("gql-status").textContent,/HTTP 403/);
  assert.match(el("gql-result").textContent,/Forbidden/);
  assert.ok(getToken());
});
test("old playground results and finally cannot affect a newer running query", async () => {
  const old=deferred(), next=deferred();
  globalThis.fetch=()=>old.promise;
  const first=runPlaygroundQuery();
  newSession(); resetPlayground(); setToken(tokenFor("new"));
  globalThis.fetch=()=>next.promise;
  const second=runPlaygroundQuery();
  old.resolve({ok:false,status:401}); await first;
  assert.ok(getToken());
  assert.equal(el("gql-run").disabled,true);
  assert.equal(el("gql-status").textContent,"Running…");
  next.resolve({ok:true,status:200,json:async()=>({data:{user:[]}})}); await second;
  assert.equal(el("gql-run").disabled,false);
  assert.deepEqual(JSON.parse(el("gql-result").textContent),{data:{user:[]}});
});
for (const body of [null,{},[],{errors:[null]},{errors:"oops"}]) {
  test(`malformed envelope ${JSON.stringify(body)} reports a response failure`, async () => {
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>body});
    await runPlaygroundQuery();
    assert.match(el("gql-result").textContent,/invalid GraphQL response/);
    assert.equal(el("gql-run").disabled,false);
  });
}
