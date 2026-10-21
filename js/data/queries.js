/* ---------------- GRAPHQL QUERIES ---------------- */
//
// Every query the dashboard sends, in one place, so an auditor can read the
// full set without hunting through render code — and so the three required
// query forms are visible side by side:
//
//   NORMAL           -> USER
//   NESTED           -> XP_TRANSACTIONS, RECENT_PROJECTS  (object { ... } inside)
//   WITH ARGUMENTS   -> XP_TRANSACTIONS, AUDIT_TOTALS, SKILLS, RECENT_PROJECTS
//
// The XP queries fetch `path` and filter on the cursus root, then the data layer
// excludes nested Piscine rows the platform's own XP board does not count — see
// isCursusPath() in profile.js and the CURSUS_ROOT comment in config.js.

import { CURSUS_ROOT } from "../config.js";

// The app's NORMAL query: no arguments, no nesting.
export const USER = `{ user { id login } }`;

// WITH ARGUMENTS (where: type _eq "xp"), ordered so the same rows serve both
// the XP total and both XP graphs. `createdAt` is fetched here even
// though the total ignores it — one request feeding both beats two requests.
export const XP_TRANSACTIONS = `query XpTransactions($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "xp" }
      path: { _like: "${CURSUS_ROOT}/%" }
    }
    order_by: [{ createdAt: asc }, { id: asc }]
  ) {
    id
    objectId
    amount
    createdAt
    path
    object {
      id
      name
    }
  }
}`;

// WITH ARGUMENTS (_in). XP given to others ("up") and received ("down").
export const AUDIT_TOTALS = `query AuditTotals($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    order_by: { id: asc }
    where: { type: { _in: ["up", "down"] } }) { id type amount }
}`;

// NESTED: the latest project results with the related `object` inside each.
export const RECENT_PROJECTS = `query RecentProjects($limit: Int = 500, $offset: Int = 0) {
  result(
    limit: $limit
    offset: $offset
    where: {
      path: { _like: "${CURSUS_ROOT}/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: [{ createdAt: desc }, { id: desc }]
  ) {
    id
    grade
    path
    object {
      name
      type
    }
  }
}`;

// WITH ARGUMENTS. Level is recorded as its own transaction type, re-issued each
// time the user levels up — so the CURRENT level is the highest amount, not a
// sum. Scoped to the cursus root like the XP queries: a Piscine runs its own
// level track, and those rows would otherwise outrank the cursus level.
//
// Read every page before taking the maximum. Selecting only the top row
// before the Piscine filter could report a Piscine level as the cursus one.
export const LEVEL = `query Level($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "level" }
      path: { _like: "${CURSUS_ROOT}/%" }
    }
    order_by: [{ amount: desc }, { id: asc }]
  ) {
    id
    amount
    path
  }
}`;

// WITH ARGUMENTS (_like). Skills are transactions typed `skill_*`, where
// `amount` is a percentage rather than XP.
export const SKILLS = `query Skills($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: { type: { _like: "skill_%" } }
    order_by: [{ amount: desc }, { id: asc }]
  ) {
    id
    type
    amount
  }
}`;

// Paging stops only on an empty page, even if the platform caps a page below
// $limit. All list orders include the stable row ID to break equal-date ties.
