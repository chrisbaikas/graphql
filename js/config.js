/* ---------------- CONFIG ---------------- */

// Zone01 platform domain. Used for both auth (signin) and GraphQL.
// API URLs are derived here. If changing domains, also update the static
// connect-src allowlist in index.html; meta CSP cannot import this module.
const DOMAIN = "platform.zone01.gr";
export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// Athens main cursus. Keep roll-ups and exams; isCursusPath() in data/profile.js
// excludes nested Piscine exercises so their XP is not counted twice.
export const CURSUS_ROOT = "/athens/div-01";
export const PISCINE_SEGMENT = /^piscine(-|$)/i;

export const PROFILE_PAGE_SIZE = 500;
export const RECENT_LIMIT = 60;

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
