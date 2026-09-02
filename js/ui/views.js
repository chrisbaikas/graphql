/* ---------------- VIEWS ---------------- */
//
// Switching between the login and dashboard views, plus the loading and reset
// states of the profile itself.

import { clearProfileCache } from "../data/profile.js";
import { resetProjectsCache } from "../charts/projectsGraph.js";
import { resetAllOverflow } from "./collapsible.js";
import { resetPlayground } from "../playground.js";
import { clearDashboardError } from "./errors.js";
import { newSession } from "../core/session.js";

import { loadUserSection } from "../sections/user.js";
import { loadXpSection } from "../sections/xp.js";
import { loadAuditSection } from "../sections/audit.js";
import { loadRecentSection } from "../sections/recent.js";
import { loadSkillsSection } from "../sections/skills.js";
import { loadStatsSection } from "../sections/stats.js";

export function showLogin() {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  // `flex`, not `block`: an inline display would override the stylesheet's
  // `display: flex` on #login-view and drop the card out of the centre.
  if (loginView) loginView.style.display = "flex";
  if (dashboardView) dashboardView.style.display = "none";
}

export function showDashboard() {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  if (loginView) loginView.style.display = "none";
  if (dashboardView) dashboardView.style.display = "block";
  loadProfile();
}

// Loads every dashboard section. Each section loader handles its own errors so
// one failing query doesn't blank the whole profile.
//
// The loaders are started together, not awaited in sequence: several of them
// share rows through the data layer's cache, so a concurrent start is what lets
// the shared fetches collapse into one request each.
export function loadProfile() {
  // A new generation invalidates anything still in flight from a previous load
  // or a previous user, so a late response can no longer paint this dashboard.
  newSession();
  clearDashboardError();
  clearProfileCache(); // a reload must re-fetch, not replay the last load
  showLoading();
  loadUserSection();
  loadXpSection();
  loadAuditSection();
  loadRecentSection();
  loadSkillsSection();
  loadStatsSection();
}

// Show a "Loading…" hint in every value slot until each section's data arrives.
export function showLoading() {
  resetAllOverflow();

  const recent = document.getElementById("recent-list");
  if (recent) recent.innerHTML = "<li>Loading…</li>";
  const skills = document.getElementById("skills-list");
  if (skills) skills.innerHTML = "<li>Loading…</li>";

  const profile = document.getElementById("profile");
  if (!profile) return;
  for (const dd of profile.querySelectorAll(".info dd")) {
    dd.textContent = "Loading…";
  }
  for (const box of profile.querySelectorAll(".graph-box")) {
    box.innerHTML = '<p class="graph-placeholder">Loading…</p>';
  }
}

// Reset every rendered profile value back to its placeholder without destroying
// the DOM structure (so loadProfile() can refill it on the next login).
//
// The cache-clearing calls come first, before any DOM lookup can bail out: they
// are what actually drop the previous user's data, and skipping them because a
// container element is missing would leave that data in memory.
export function resetProfile() {
  // Same generation bump on the way out: requests started by the user who is
  // logging out are now stale and will discard their own results.
  newSession();
  clearProfileCache();
  resetProjectsCache();
  resetPlayground();
  clearDashboardError();
  resetAllOverflow();

  const recent = document.getElementById("recent-list");
  if (recent) recent.innerHTML = "<li>—</li>";
  const skills = document.getElementById("skills-list");
  if (skills) skills.innerHTML = "<li>—</li>";

  const profile = document.getElementById("profile");
  if (!profile) return;
  for (const dd of profile.querySelectorAll(".info dd")) {
    dd.textContent = "—";
  }
  for (const box of profile.querySelectorAll(".graph-box")) {
    box.innerHTML = '<p class="graph-placeholder">—</p>';
  }
}
