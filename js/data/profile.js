/* Fetch plain profile data, deduplicating requests within each session load. */

import { CURSUS_ROOT, PISCINE_SEGMENT, PROFILE_PAGE_SIZE, RECENT_LIMIT } from "../config.js";
import { graphqlRequest } from "../core/graphql.js";
import * as QUERIES from "./queries.js";
import { currentSession } from "../core/session.js";
import { formatSkillName } from "../ui/format.js";

let cache = {};
let cacheSession = currentSession();

// Keep cursus projects, exams and Piscine roll-ups, but exclude exercises
// inside a Piscine: the roll-up already includes their XP.
export function isCursusPath(path) {
  if (typeof path !== "string") return false;
  if (!path.startsWith(`${CURSUS_ROOT}/`)) return false;

  const segments = path.slice(CURSUS_ROOT.length + 1).split("/").filter(Boolean);
  if (!segments.length) return false;

  // A Piscine anywhere but the final segment means this row sits inside the
  // Piscine, so the roll-up already covers it. The Piscine row itself ends
  // there and is kept.
  return !segments.slice(0, -1).some((segment) => PISCINE_SEGMENT.test(segment));
}

export function clearProfileCache() {
  cacheSession = currentSession();
  cache = {};
}

// Cache the original promise so concurrent consumers share it. Failed entries
// are evicted only if they still belong to this load; newer entries stay intact.
function once(key, fn) {
  if (cacheSession !== currentSession()) clearProfileCache();
  if (!cache[key]) {
    const promise = fn();
    promise.catch(() => {
      if (cache[key] === promise) delete cache[key];
    });
    cache[key] = promise;
  }
  return cache[key];
}

// Missing arrays/invalid numbers are errors, not believable zero totals.
function rowsFrom(data, field) {
  const rows = data[field];
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error(`Invalid ${field} data returned by the platform.`);
  }
  return rows;
}

function amountOf(row) {
  if (row.amount === null) return 0;
  if (!Number.isFinite(row.amount)) throw new Error("Invalid transaction amount returned by the platform.");
  return row.amount;
}

async function fetchRows(query, field, hasEnoughRows = () => false) {
  const rows = [];
  const seen = new Set();
  while (true) {
    const data = await graphqlRequest(query, { limit: PROFILE_PAGE_SIZE, offset: rows.length });
    const page = rowsFrom(data, field);
    if (!page.length) return rows;
    for (const row of page) {
      if (!Number.isInteger(row.id)) throw new Error("Invalid row ID returned by the platform.");
      if (seen.has(row.id)) throw new Error("Platform data changed during loading. Please reload.");
      seen.add(row.id);
      rows.push(row);
    }
    if (hasEnoughRows(rows)) return rows;
  }
}

// The NORMAL query. Returns { id, login } or throws if the platform returned
// no user at all.
export function fetchUser() {
  return once("user", async () => {
    const data = await graphqlRequest(QUERIES.USER);
    const user = rowsFrom(data, "user")[0];
    if (!user || typeof user.login !== "string" || !Number.isInteger(user.id)) throw new Error("No user data returned.");
    return user;
  });
}

// Every xp transaction, oldest first: [{ amount, createdAt }, ...].
// Shared by the XP total card and the cumulative-XP graph.
export function fetchXpTransactions() {
  return once("xp", async () => {
    const rows = await fetchRows(QUERIES.XP_TRANSACTIONS, "transaction");
    return rows.filter((t) => isCursusPath(t.path)).map((t) => {
      if (typeof t.createdAt !== "string" || !Number.isFinite(Date.parse(t.createdAt))) {
        throw new Error("Invalid XP date returned by the platform.");
      }
      return { ...t, amount: amountOf(t) };
    });
  });
}

// Prefer the platform's name: nested path slugs can lose the parent project
// (e.g. ascii-art-web/export-file). Use the slug only when no object is linked.
function labelForRow(row) {
  const name = row.object?.name;
  if (name) return name;

  const segments = String(row.path || "").split("/").filter(Boolean);
  const slug = segments[segments.length - 1] || "Unknown";
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The xp rows as the XP card lists them: [{ name, amount, createdAt }, ...],
// newest first — the same rows, in the same order, as the platform's XP board.
export async function fetchXpBreakdown() {
  const transactions = await fetchXpTransactions();
  return transactions
    .map((t) => ({
      name: labelForRow(t),
      amount: t.amount,
      createdAt: t.createdAt
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Total XP in bytes, summed from the rows above — no extra request.
export async function fetchTotalXp() {
  const transactions = await fetchXpTransactions();
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

// The current cursus level — the highest `level` transaction the platform
// counts. Levels are re-issued on each level-up rather than accumulated, so the
// maximum is the current level, never the sum.
export function fetchLevel() {
  return once("level", async () => {
    const rows = (await fetchRows(QUERIES.LEVEL, "transaction")).filter((t) => isCursusPath(t.path));
    if (!rows.length) return null;
    return rows.reduce((max, t) => Math.max(max, amountOf(t)), 0);
  });
}

// Audit XP totals: given to others (`done` = "up") and received from others
// (`received` = "down"). Shared by the audit card and the audit graph.
export function fetchAuditTotals() {
  return once("audit", async () => {
    const transactions = await fetchRows(QUERIES.AUDIT_TOTALS, "transaction");
    let done = 0;
    let received = 0;
    for (const t of transactions) {
      if (t.type !== "up" && t.type !== "down") throw new Error("Invalid audit type returned by the platform.");
      if (t.type === "up") done += amountOf(t);
      else received += amountOf(t);
    }
    return { done, received };
  });
}

// Recent project results as [{ name, passed }, ...], newest first.
export function fetchRecentProjects() {
  return once("recent", async () => {
    const rows = await fetchRows(QUERIES.RECENT_PROJECTS, "result",
      (page) => page.filter((r) => isCursusPath(r.path)).length >= RECENT_LIMIT);
    const results = rows.filter((r) => isCursusPath(r.path)).slice(0, RECENT_LIMIT);
    return results.map((r) => ({
      name: r.object?.name || "Unknown",
      passed: Number.isFinite(r.grade) ? r.grade >= 1 : null
    }));
  });
}

// Current skill levels as [{ name, amount }, ...], strongest first.
//
// A skill is re-recorded as it improves, so the CURRENT level is the highest
// amount seen for that type — not the sum. Compute the maximum explicitly so
// neither page ordering nor ties can select an older, lower score.
export function fetchSkills() {
  return once("skills", async () => {
    const transactions = await fetchRows(QUERIES.SKILLS, "transaction");

    const best = new Map();
    for (const t of transactions) {
      if (typeof t.type !== "string") throw new Error("Invalid skill type returned by the platform.");
      if (!t.type.startsWith("skill_")) continue;
      best.set(t.type, Math.max(best.get(t.type) ?? -Infinity, amountOf(t)));
    }

    return [...best.entries()]
      .map(([type, amount]) => ({ name: formatSkillName(type), amount }))
      .sort((a, b) => b.amount - a.amount);
  });
}

// Group payouts by object ID, not display name: different objects can share
// a name. Rows without a linked object fall back to objectId or remain separate.
export function fetchProjectXp() {
  return once("projectXp", async () => {
    const transactions = await fetchXpTransactions();

    const totals = new Map();
    for (const transaction of transactions) {
      const objectId = transaction.object?.id ?? transaction.objectId;
      const key = objectId ?? `transaction:${transaction.id}`;
      const entry = totals.get(key);
      if (entry) {
        entry.amount += transaction.amount;
      } else {
        totals.set(key, { name: labelForRow(transaction), amount: transaction.amount });
      }
    }

    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  });
}
