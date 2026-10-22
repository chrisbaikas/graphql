/* Login/dashboard routing and shared loading/logout reset. */
import { clearProfileCache } from "../data/profile.js";
import { resetProjectsCache } from "../charts/projectsGraph.js";
import { resetAllOverflow } from "./collapsible.js";
import { resetPlayground } from "../playground.js";
import { clearDashboardError } from "./errors.js";
import { newSession } from "../core/session.js";
import { closeGraphModal } from "./modal.js";
import { COLLAPSIBLE_LISTS } from "../config.js";

import { loadUserSection } from "../sections/user.js";
import { loadXpSection } from "../sections/xp.js";
import { loadAuditSection } from "../sections/audit.js";
import { loadRecentSection } from "../sections/recent.js";
import { loadSkillsSection } from "../sections/skills.js";
import { loadStatsSection } from "../sections/stats.js";

export function showLogin() {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  if (loginView) loginView.style.display = "flex";
  if (dashboardView) dashboardView.style.display = "none";
  document.getElementById("username")?.focus();
}

export function showDashboard() {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  if (loginView) loginView.style.display = "none";
  if (dashboardView) dashboardView.style.display = "block";
  loadProfile();
  dashboardView?.querySelector("h1")?.focus();
}

function loadProfile() {
  resetDashboard("Loading…");
  // Start together so consumers of the same rows share the cached request.
  loadUserSection();
  loadXpSection();
  loadAuditSection();
  loadRecentSection();
  loadSkillsSection();
  loadStatsSection();
}

export function resetProfile() {
  resetDashboard("—");
}

function resetDashboard(placeholder) {
  // Invalidate async work and clear caches before touching the rendered state.
  newSession();
  closeGraphModal(false);
  clearProfileCache();
  resetProjectsCache();
  resetPlayground();
  clearDashboardError();
  resetAllOverflow();
  renderPlaceholders(placeholder);
}

function renderPlaceholders(text) {
  for (const [listId] of COLLAPSIBLE_LISTS) {
    const list = document.getElementById(listId);
    if (!list) continue;
    const item = document.createElement("li");
    item.textContent = text;
    list.replaceChildren(item);
  }

  const profile = document.getElementById("profile");
  if (!profile) return;
  for (const value of profile.querySelectorAll(".info dd")) {
    value.textContent = text;
  }
  for (const box of profile.querySelectorAll(".graph-box")) {
    const message = document.createElement("p");
    message.className = "graph-placeholder";
    message.textContent = text;
    box.removeAttribute("aria-description");
    box.replaceChildren(message);
  }
}
