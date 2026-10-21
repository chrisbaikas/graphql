/* ---------------- CONFIG ---------------- */

// Zone01 platform domain. Used for both auth (signin) and GraphQL.
// API URLs are derived here. If changing domains, also update the static
// connect-src allowlist in index.html; meta CSP cannot import this module.
export const DOMAIN = "platform.zone01.gr";
export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// The main-cursus root. Every transaction carries the `path` of the object that
// earned it, and the cursus tree has depth:
//
//   /athens/div-01/ascii-art                      <- a project
//   /athens/div-01/checkpoint/safe-sum            <- an exam exercise
//   /athens/div-01/piscine-rust                   <- a Piscine, rolled up
//   /athens/div-01/piscine-rust/quest-01/ex-03    <- inside that Piscine
//
// The platform's own XP board counts the first three and not the fourth. A
// Piscine is scored twice in the raw data — once as a rolled-up total on the
// Piscine object itself ("Piscine Rust — 390 kB"), and again on every exercise
// underneath it. The board keeps the roll-up and ignores the children; summing
// both double-counts the Piscines and inflates the total.
export const CURSUS_ROOT = "/athens/div-01";

// So the rule is: keep everything under the cursus root EXCEPT the rows nested
// inside a Piscine roll-up.
//
// This is deliberately an exclude-list rather than an allow-list of "valid"
// depths. Exams are foldered and the folder name is not stable — older ones sit
// under `checkpoint/`, newer ones elsewhere — so an allow-list silently drops
// whichever exams it fails to predict, and the total comes out just slightly
// short in a way that is easy to miss. Piscines, by contrast, are the one thing
// that is genuinely double-counted, and they are identifiable by name.
export const PISCINE_SEGMENT = /^piscine(-|$)/i;

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
