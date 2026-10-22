import test from "node:test";
import assert from "node:assert/strict";
import { graphqlRequest } from "../js/core/graphql.js";
import { currentSession, newSession, registerSessionEnd, SilentError } from "../js/core/session.js";
import { deferred, memoryStorage, tokenFor as token } from "./helpers.js";
import { getToken, setToken, clearToken } from "../js/core/storage.js";

globalThis.sessionStorage = memoryStorage();
let ended;
test.beforeEach(() => {
  newSession();
  setToken(token("A"));
  ended = [];
  registerSessionEnd((message) => { ended.push(message); clearToken(); newSession(); });
});

const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

test("GraphQL sends Bearer auth and variables, and returns data", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${getToken()}`);
    assert.deepEqual(JSON.parse(options.body), { query: "query Q($id: Int!) { user { id } }", variables: {id: 42} });
    return response({ data: { user: [{id: 42}] } });
  };
  assert.deepEqual(await graphqlRequest("query Q($id: Int!) { user { id } }", {id: 42}), {user: [{id: 42}]});
});

for (const mode of ["headers", "body"]) {
  test(`old ${mode} response cannot log out the next user`, async () => {
    const waiting = deferred();
    const startedBody = deferred();
    globalThis.fetch = mode === "headers"
      ? () => waiting.promise
      : async () => ({ ok: true, status: 200, json: () => { startedBody.resolve(); return waiting.promise; } });
    const pending = graphqlRequest("{ user { id } }");
    if (mode === "body") await startedBody.promise;
    const nextToken = token("B");
    newSession(); setToken(nextToken);
    waiting.resolve(mode === "headers" ? response({}, 401) : {errors:[{message:"JWT expired"}]});
    await assert.rejects(pending, SilentError);
    assert.equal(getToken(), nextToken);
    assert.deepEqual(ended, []);
  });
}

test("concurrent 401s end the session once with a visible reason", async () => {
  globalThis.fetch = async () => response({}, 401);
  const results = await Promise.allSettled([graphqlRequest("{}"), graphqlRequest("{}")]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(ended.length, 1);
  assert.match(ended[0], /session is no longer valid/);
});

test("HTTP 200 JWT errors end the session", async () => {
  globalThis.fetch = async () => response({errors:[{message:"Could not verify JWT", extensions:{code:"invalid-jwt"}}]});
  await assert.rejects(graphqlRequest("{}"), SilentError);
  assert.equal(ended.length, 1);
});

test("query validation errors preserve the session", async () => {
  const generation = currentSession();
  globalThis.fetch = async () => response({errors:[{message:'field "tokenCount" not found'}]});
  await assert.rejects(graphqlRequest("{}"), /tokenCount/);
  assert.equal(currentSession(), generation);
  assert.deepEqual(ended, []);
});

for (const body of [null, {}, [], {data: null}]) {
  test(`invalid GraphQL envelope ${JSON.stringify(body)} reports a readable error`, async () => {
    globalThis.fetch = async () => response(body);
    await assert.rejects(graphqlRequest("{}"), /invalid response/);
  });
}

for (const [status, body, expected] of [
  [403,{errors:[{message:"Permission denied",extensions:{code:"access-denied"}}]},/Access denied.*403.*Permission denied/],
  [400,{errors:[{message:"Unknown field"}]},/400.*Unknown field/],
  [502,{message:"Upstream unavailable"},/502.*Upstream unavailable/]
]) {
  test(`HTTP ${status} retains useful detail and preserves a usable session`, async () => {
    globalThis.fetch=async()=>response(body,status);
    await assert.rejects(graphqlRequest("{}"),expected);
    assert.deepEqual(ended,[]);
  });
}
test("partial dashboard data with GraphQL errors is rejected rather than displayed as a total", async () => {
  globalThis.fetch=async()=>response({data:{transaction:[]},errors:[{message:"not allowed",extensions:{code:"access-denied"}}]});
  await assert.rejects(graphqlRequest("{}"),/not allowed/);
  assert.deepEqual(ended,[]);
});
for(const body of [{errors:[null]},{errors:["oops"]},{data:{},errors:"oops"}]) {
  test(`malformed errors ${JSON.stringify(body)} never cause a TypeError`,async()=>{
    globalThis.fetch=async()=>response(body);
    await assert.rejects(graphqlRequest("{}"),/invalid response/);
  });
}
test("missing/expired credentials perform no fetch", async()=>{
  clearToken();
  globalThis.fetch=()=>assert.fail("must not request");
  await assert.rejects(graphqlRequest("{}"),SilentError);
});
test("malformed JSON is distinguished from HTTP and network failures", async()=>{
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError("bad JSON");}});
  await assert.rejects(graphqlRequest("{}"),/invalid JSON/);
  globalThis.fetch=async()=>({ok:false,status:503,json:async()=>{throw new SyntaxError("HTML page");}});
  await assert.rejects(graphqlRequest("{}"),/503/);
});
