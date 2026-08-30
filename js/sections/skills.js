// Bonus — Skills breakdown: extra information beyond the three mandatory
// sections. Rendered as labelled bars, not an SVG graph, so it stays distinct
// from the Statistics section.
//
// Defensive by design: the query matches `skill_%` with `_like`, so if this
// platform exposes no skill rows at all the card shows an empty state instead
// of an error.

import { SKILLS_VISIBLE } from "../config.js";
import { fetchSkills } from "../data/profile.js";
import { applyOverflow, resetOverflow } from "../ui/collapsible.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadSkillsSection() {
  const listEl = document.getElementById("skills-list");
  if (!listEl) return;

  const session = currentSession();

  try {
    const skills = await fetchSkills();
    if (!isCurrentSession(session)) return;

    listEl.innerHTML = "";
    resetOverflow("skills-list", "skills-toggle");

    if (!skills.length) {
      listEl.innerHTML = "<li>No skill data available.</li>";
      return;
    }

    // Every skill is rendered; applyOverflow() below hides the ones past
    // SKILLS_VISIBLE behind the toggle.
    for (const skill of skills) {
      listEl.appendChild(renderSkill(skill));
    }

    applyOverflow("skills-list", "skills-toggle", ".skill", SKILLS_VISIBLE);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    listEl.innerHTML = "<li>—</li>";
    resetOverflow("skills-list", "skills-toggle");
    reportSectionError("Could not load skills", err);
  }
}

// One <li>: name, proportional bar, percentage.
function renderSkill(skill) {
  // Percentages are capped at 100 for the bar width only — an out-of-range
  // value would otherwise overflow the card.
  const pct = Math.max(0, Math.min(100, skill.amount));

  const li = document.createElement("li");
  li.className = "skill";

  const name = document.createElement("span");
  name.className = "skill-name";
  name.textContent = skill.name;

  const bar = document.createElement("span");
  bar.className = "skill-bar";
  const fill = document.createElement("span");
  fill.className = "skill-fill";
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);

  const value = document.createElement("span");
  value.className = "skill-value";
  value.textContent = `${skill.amount}%`;

  li.append(name, bar, value);
  return li;
}
