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
// The XP queries fetch `path` and filter on the cursus root, then the data layer
// narrows further to the depth the platform's own XP board counts — see
// isCursusPath() in profile.js and the CURSUS_ROOT comment in config.js.

import { CURSUS_ROOT } from "../config.js";

// The app's NORMAL query: no arguments, no nesting.
export const USER = `{ user { id login } }`;

// WITH ARGUMENTS (where: type _eq "xp"), ordered so the same rows serve both
// the XP total and the cumulative-XP graph. `createdAt` is fetched here even
// though the total ignores it — one request feeding both beats two requests.
export const XP_TRANSACTIONS = `{
  transaction(
    where: {
      type: { _eq: "xp" }
      path: { _like: "${CURSUS_ROOT}/%" }
    }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
    path
    object {
      name
    }
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
      path: { _like: "${CURSUS_ROOT}/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: { createdAt: desc }
    limit: 60
  ) {
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
// No `limit: 1` — the cursus/Piscine split is the depth rule the server cannot
// express, so the rows are narrowed in JS and the max taken there. Limiting
// here would pick the top row *before* that filter and could hand back a
// Piscine level.
export const LEVEL = `{
  transaction(
    where: {
      type: { _eq: "level" }
      path: { _like: "${CURSUS_ROOT}/%" }
    }
    order_by: { amount: desc }
  ) {
    amount
    path
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
      path: { _like: "${CURSUS_ROOT}/%" }
    }
    order_by: { amount: desc }
  ) {
    amount
    objectId
    path
    object {
      id
      name
    }
  }
}`;
