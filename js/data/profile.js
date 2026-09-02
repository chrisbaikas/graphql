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

import { CURSUS_ROOT, CURSUS_GROUP_SEGMENTS } from "../config.js";
import { graphqlRequest } from "../core/graphql.js";
import * as QUERIES from "./queries.js";
import { formatSkillName } from "../ui/format.js";

let cache = {};

// Does this path name a row the platform's own XP board counts?
//
// The queries already restrict to the cursus root, but that is a prefix and the
// cursus contains Piscines, which are scored twice over: once as a rolled-up
// total on the Piscine itself ("/athens/div-01/piscine-rust" -> 390 kB) and
// again on every exercise inside it. Counting both double-counts the Piscine.
// The platform keeps the roll-up, so we keep the roll-up.
//
// The rule is therefore about depth, not prefix. Relative to CURSUS_ROOT:
//
//   ascii-art               1 segment   -> keep (a project, or a Piscine total)
//   checkpoint/safe-sum     2, grouped  -> keep (exam exercises live in folders)
//   piscine-rust/q-01/ex-3  3           -> drop (inside a Piscine roll-up)
//
// Anything outside the cursus root is dropped outright, so a caller can hand
// this every row it has without pre-filtering.
export function isCursusPath(path) {
  if (typeof path !== "string") return false;
  if (!path.startsWith(`${CURSUS_ROOT}/`)) return false;

  const segments = path.slice(CURSUS_ROOT.length + 1).split("/").filter(Boolean);
  if (segments.length === 1) return true;
  // A grouping folder is scaffolding, not an earnable object, so its direct
  // children are the real rows — but only one level down.
  if (segments.length === 2 && CURSUS_GROUP_SEGMENTS.includes(segments[0])) {
    return true;
  }
  return false;
}

// "/athens/div-01/piscine-rust" -> "Piscine rust". The last path segment is the
// object's slug, which is what the platform labels the row with.
function labelFromPath(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  const slug = segments[segments.length - 1] || "Unknown";
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
    return (data.transaction || []).filter((t) => isCursusPath(t.path));
  });
}

// The xp rows as the XP card lists them: [{ name, amount, createdAt }, ...],
// newest first. The name comes from the path's last segment — the same label
// the platform's own XP board shows ("piscine-rust" -> "Piscine Rust").
export async function fetchXpBreakdown() {
  const transactions = await fetchXpTransactions();
  return transactions
    .map((t) => ({
      name: labelFromPath(t.path),
      amount: t.amount || 0,
      createdAt: t.createdAt
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    const results = (data.result || []).filter((r) => isCursusPath(r.path));
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
// A project can pay out more than once, so its rows are totalled rather than
// trusting a single one.
//
// Grouping is by the object's ID, never by its name. Two distinct projects can
// share a display name (the same exercise offered on two paths, say), and rows
// with no linked object have no name at all — keying on the name would merge
// unrelated projects into one bar and pile every orphan row into a single
// "Unknown". The name is carried along purely as the bar's label.
export function fetchProjectXp() {
  return once("projectXp", async () => {
    const data = await graphqlRequest(QUERIES.PROJECT_XP);
    const transactions = (data.transaction || []).filter((t) =>
      isCursusPath(t.path)
    );

    const totals = new Map();
    for (const t of transactions) {
      const object = t.object || null;
      // objectId is the fallback key when the nested object didn't come back;
      // a row with neither keeps its own identity rather than joining a shared
      // "Unknown" bucket.
      const id = (object && object.id) ?? t.objectId ?? `unknown:${totals.size}`;
      const name = (object && object.name) || "Unknown";

      const entry = totals.get(id);
      if (entry) entry.amount += t.amount || 0;
      else totals.set(id, { name, amount: t.amount || 0 });
    }

    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  });
}
