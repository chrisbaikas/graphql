/* ---------------- PROFILE DATA ---------------- */
//
// The fetch layer. Every function here returns plain data and touches no DOM,
// so the render code in sections/ and charts/ can be read (and reasoned about)
// without network concerns mixed in.
//
// Each fetcher caches its in-flight promise for the current dashboard load.
// loadProfile() starts several consumers at once and more than one of them
// wants the same rows: the XP card and the XP-over-time graph share
// XP_TRANSACTIONS, and the audit card and audit graph share AUDIT_TOTALS.
// Caching the promise (not the resolved value) means concurrent callers join
// the same request rather than racing two identical ones.
//
// clearProfileCache() drops everything, so one user's data can never be served
// to the next — it is called by logout() and again at the start of each load.

import { graphqlRequest } from "../core/graphql.js";
import * as QUERIES from "./queries.js";
import { formatSkillName } from "../ui/format.js";

let cache = {};

export function clearProfileCache() {
  cache = {};
}

// Run `fn` once per load, keyed by name; concurrent callers share the promise.
//
// The promise itself is cached, and eviction is attached as a separate handler
// rather than by caching `fn().catch(...)`. Caching the derived promise would
// leave a rejection with no handler in the window between eviction and the next
// caller, which surfaces as an unhandled rejection even though every caller
// does have a try/catch. `catch(() => {})` on the eviction branch keeps that
// bookkeeping chain settled; callers still see the real rejection because they
// await the original promise.
function once(key, fn) {
  if (!cache[key]) {
    const promise = fn();
    promise.catch(() => { if (cache[key] === promise) delete cache[key]; });
    cache[key] = promise;
  }
  return cache[key];
}

// The NORMAL query. Returns { id, login } or throws if the platform returned
// no user at all.
export function fetchUser() {
  return once("user", async () => {
    const data = await graphqlRequest(QUERIES.USER);
    const user = data.user && data.user[0];
    if (!user) throw new Error("No user data returned.");
    return user;
  });
}

// Every xp transaction, oldest first: [{ amount, createdAt }, ...].
// Shared by the XP total card and the cumulative-XP graph.
export function fetchXpTransactions() {
  return once("xp", async () => {
    const data = await graphqlRequest(QUERIES.XP_TRANSACTIONS);
    return data.transaction || [];
  });
}

// Total XP in bytes, summed from the rows above — no extra request.
export async function fetchTotalXp() {
  const transactions = await fetchXpTransactions();
  return transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
}

// Audit XP totals: given to others (`done` = "up") and received from others
// (`received` = "down"). Shared by the audit card and the audit graph.
export function fetchAuditTotals() {
  return once("audit", async () => {
    const data = await graphqlRequest(QUERIES.AUDIT_TOTALS);
    const transactions = data.transaction || [];
    let done = 0;
    let received = 0;
    for (const t of transactions) {
      if (t.type === "up") done += t.amount || 0;
      else if (t.type === "down") received += t.amount || 0;
    }
    return { done, received };
  });
}

// Recent project results as [{ name, passed }, ...], newest first.
export function fetchRecentProjects() {
  return once("recent", async () => {
    const data = await graphqlRequest(QUERIES.RECENT_PROJECTS);
    const results = data.result || [];
    return results.map((r) => ({
      name: (r.object && r.object.name) || "Unknown",
      passed: r.grade >= 1
    }));
  });
}

// Current skill levels as [{ name, amount }, ...], strongest first.
//
// A skill is re-recorded as it improves, so the CURRENT level is the highest
// amount seen for that type — not the sum. The query orders by amount desc, so
// the first row for a given type is already its peak.
export function fetchSkills() {
  return once("skills", async () => {
    const data = await graphqlRequest(QUERIES.SKILLS);
    const transactions = data.transaction || [];

    const best = new Map();
    for (const t of transactions) {
      if (!best.has(t.type)) best.set(t.type, t.amount || 0);
    }

    return [...best.entries()]
      .map(([type, amount]) => ({ name: formatSkillName(type), amount }))
      .sort((a, b) => b.amount - a.amount);
  });
}

// XP totalled per project as [{ name, amount }, ...], largest first.
// A project can pay out more than once, so total per name rather than trusting
// a single row.
export function fetchProjectXp() {
  return once("projectXp", async () => {
    const data = await graphqlRequest(QUERIES.PROJECT_XP);
    const transactions = data.transaction || [];

    const totals = new Map();
    for (const t of transactions) {
      const name = (t.object && t.object.name) || "Unknown";
      totals.set(name, (totals.get(name) || 0) + (t.amount || 0));
    }

    return [...totals.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  });
}
