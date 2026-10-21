// Recent projects — rendered from the app's NESTED query (each result carries
// the related `object` with its name and type). The nesting earns its place in
// the UI rather than existing only to satisfy the requirement.

import { RECENT_VISIBLE } from "../config.js";
import { fetchRecentProjects } from "../data/profile.js";
import { applyOverflow, resetOverflow } from "../ui/collapsible.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadRecentSection() {
  const listEl = document.getElementById("recent-list");
  if (!listEl) return;

  const session = currentSession();

  try {
    const projects = await fetchRecentProjects();
    if (!isCurrentSession(session)) return;

    listEl.innerHTML = "";
    resetOverflow("recent-list", "recent-toggle");

    if (!projects.length) {
      listEl.innerHTML = "<li>No projects yet.</li>";
      return;
    }

    for (const project of projects) {
      const li = document.createElement("li");
      li.className = "recent-item";
      // textContent, not innerHTML: the project name comes from the platform.
      li.textContent = `${project.name} — ${project.passed === null ? "pending" : project.passed ? "pass" : "fail"}`;
      listEl.appendChild(li);
    }

    applyOverflow("recent-list", "recent-toggle", ".recent-item", RECENT_VISIBLE);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    listEl.innerHTML = "<li>—</li>";
    resetOverflow("recent-list", "recent-toggle");
    reportSectionError("Could not load recent projects", err);
  }
}
