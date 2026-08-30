/* ---------------- CONFIG ---------------- */

// Zone01 platform domain. Used for both auth (signin) and GraphQL.
// Single source of truth: derive URLs from here, never hardcode them elsewhere.
export const DOMAIN = "platform.zone01.gr";
export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// The sessionStorage key the JWT is stored under. Reads and writes go through
// core/storage.js rather than touching storage directly.
export const TOKEN_KEY = "token";

// How many rows each collapsible list shows before offering "Show more".
export const SKILLS_VISIBLE = 6;
export const RECENT_VISIBLE = 5;
export const PROJECTS_VISIBLE = 8;

// Every CSS-collapsible list on the dashboard: [listId, toggleId]. The project
// graph isn't here — an SVG is redrawn rather than collapsed with a class.
export const COLLAPSIBLE_LISTS = [
  ["skills-list", "skills-toggle"],
  ["recent-list", "recent-toggle"],
];

// What the GraphiQL playground editor starts with, and returns to on logout.
export const DEFAULT_PLAYGROUND_QUERY = "{ user { id login } }";
