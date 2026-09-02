/* ---------------- CONFIG ---------------- */

// Zone01 platform domain. Used for both auth (signin) and GraphQL.
// Single source of truth: derive URLs from here, never hardcode them elsewhere.
export const DOMAIN = "platform.zone01.gr";
export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// The main-cursus root. Every transaction carries the `path` of the object
// that earned it, and the tree has depth:
//
//   /athens/div-01/ascii-art                      <- a cursus project
//   /athens/div-01/checkpoint/safe-sum            <- a cursus exam exercise
//   /athens/div-01/piscine-rust                   <- the Piscine, rolled up
//   /athens/div-01/piscine-rust/quest-01/ex-03    <- one Piscine exercise
//
// The platform's own XP board counts the FIRST THREE and not the fourth: a
// Piscine contributes a single rolled-up row ("Piscine Rust — 390 kB"), not the
// hundreds of child rows underneath it. Those children exist as their own xp
// transactions, so summing them as well double-counts the Piscines and inflates
// the total (1.67 MB against the platform's 1.22 MB).
//
// A `_like "/athens/div-01/%"` prefix does NOT express this — the child rows
// match that prefix too. The rule is a depth rule, so it is applied in JS after
// the fetch (see isCursusPath in data/profile.js) rather than in the query:
// keep a path if it sits directly under the cursus root, or under one of the
// non-Piscine grouping folders like `checkpoint`.
export const CURSUS_ROOT = "/athens/div-01";

// Path segments directly under CURSUS_ROOT that group real cursus work rather
// than being a single earnable object — their children still count.
export const CURSUS_GROUP_SEGMENTS = ["checkpoint", "checkpoints"];

// The sessionStorage key the JWT is stored under. Reads and writes go through
// core/storage.js rather than touching storage directly.
export const TOKEN_KEY = "token";

// How many rows each collapsible list shows before offering "Show more".
export const SKILLS_VISIBLE = 6;
export const RECENT_VISIBLE = 5;
export const XP_VISIBLE = 6;
export const PROJECTS_VISIBLE = 8;

// Every CSS-collapsible list on the dashboard: [listId, toggleId]. The project
// graph isn't here — an SVG is redrawn rather than collapsed with a class.
export const COLLAPSIBLE_LISTS = [
  ["skills-list", "skills-toggle"],
  ["recent-list", "recent-toggle"],
  ["xp-list", "xp-toggle"],
];

// What the GraphiQL playground editor starts with, and returns to on logout.
export const DEFAULT_PLAYGROUND_QUERY = "{ user { id login } }";
