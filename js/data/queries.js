/* ---------------- GRAPHQL QUERIES ---------------- */
//
// Every query the dashboard sends, in one place, so an auditor can read the
// full set without hunting through render code — and so the three required
// query forms are visible side by side:
//
//   NORMAL           -> USER
//   NESTED           -> RECENT_PROJECTS, PROJECT_XP  (object { ... } inside)
//   WITH ARGUMENTS   -> XP_TRANSACTIONS, AUDIT_TOTALS, SKILLS, RECENT_PROJECTS
//
// Every XP query is additionally scoped to CURSUS_PATH. Without it the platform
// returns Piscine rows (Go, Rust, JS, Data & AI) alongside the cursus ones, and
// the dashboard's Total XP comes out far above the figure the platform's own
// profile page shows. See config.js for why.

import { CURSUS_PATH } from "../config.js";

// The app's NORMAL query: no arguments, no nesting.
export const USER = `{ user { id login } }`;

// WITH ARGUMENTS (where: type _eq "xp"), ordered so the same rows serve both
// the XP total and the cumulative-XP graph. `createdAt` is fetched here even
// though the total ignores it — one request feeding both beats two requests.
export const XP_TRANSACTIONS = `{
  transaction(
    where: {
      type: { _eq: "xp" }
      path: { _like: "${CURSUS_PATH}" }
    }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
  }
}`;

// WITH ARGUMENTS (_in). XP given to others ("up") and received ("down").
export const AUDIT_TOTALS = `{
  transaction(where: { type: { _in: ["up", "down"] } }) { type amount }
}`;

// NESTED: the latest project results with the related `object` inside each.
export const RECENT_PROJECTS = `{
  result(
    where: {
      path: { _like: "${CURSUS_PATH}" }
      object: { type: { _eq: "project" } }
    }
    order_by: { createdAt: desc }
    limit: 30
  ) {
    grade
    object {
      name
      type
    }
  }
}`;

// WITH ARGUMENTS (_like). Skills are transactions typed `skill_*`, where
// `amount` is a percentage rather than XP.
export const SKILLS = `{
  transaction(
    where: { type: { _like: "skill_%" } }
    order_by: { amount: desc }
  ) {
    type
    amount
  }
}`;

// NESTED + WITH ARGUMENTS: each xp transaction carries the `object` that earned
// it, so the project name comes back in the same round trip.
export const PROJECT_XP = `{
  transaction(
    where: {
      type: { _eq: "xp" }
      path: { _like: "${CURSUS_PATH}" }
      object: { type: { _eq: "project" } }
    }
    order_by: { amount: desc }
  ) {
    amount
    objectId
    object {
      id
      name
    }
  }
}`;
