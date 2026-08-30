/* ---------------- SHOW MORE / SHOW LESS ---------------- */
//
// Generic collapse behaviour shared by every "top N + Show more" list. This
// module knows nothing about profiles or charts: it takes element ids and a row
// selector, and hides rows past `visible` behind a toggle.
//
// Ids are looked up fresh on each call rather than captured, so a list can be
// re-rendered (on reload, or after logout) without leaving a stale node
// reference behind.

import { COLLAPSIBLE_LISTS } from "../config.js";

export function setExpanded(listId, toggleId, expanded, hiddenCount) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (!listEl || !toggle) return;

  listEl.classList.toggle("expanded", expanded);
  if (typeof hiddenCount === "number") toggle.dataset.hidden = hiddenCount;

  const count = toggle.dataset.hidden || "";
  toggle.textContent = expanded ? "Show less" : `Show ${count} more`;
  toggle.setAttribute("aria-expanded", String(expanded));
}

// Mark rows past `visible` as overflow and show the toggle only when some are
// actually hidden. Call after rendering a list's rows.
export function applyOverflow(listId, toggleId, rowSelector, visible) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (!listEl) return;

  const rows = [...listEl.querySelectorAll(rowSelector)];
  rows.forEach((row, i) => row.classList.toggle("extra", i >= visible));

  if (!toggle) return;
  const hidden = rows.length - visible;
  if (hidden > 0) {
    setExpanded(listId, toggleId, false, hidden);
    toggle.hidden = false;
  } else {
    toggle.hidden = true;
  }
}

// Reset a collapsible list to its collapsed state and hide its toggle — used
// by the loading and logout paths so a list never returns mid-expanded.
export function resetOverflow(listId, toggleId) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (listEl) listEl.classList.remove("expanded");
  if (!toggle) return;
  toggle.hidden = true;
  // Clear the remembered count and state as well — a leftover "Show 14 more"
  // from the previous render would otherwise be read back by setExpanded().
  delete toggle.dataset.hidden;
  toggle.setAttribute("aria-expanded", "false");
}

// Collapse every list and hide the project graph's toggle too — the graph is
// redrawn rather than CSS-collapsed, so it isn't in COLLAPSIBLE_LISTS.
export function resetAllOverflow() {
  for (const [listId, toggleId] of COLLAPSIBLE_LISTS) {
    resetOverflow(listId, toggleId);
  }
  const projectsToggle = document.getElementById("projects-toggle");
  if (projectsToggle) projectsToggle.hidden = true;
}

// Wire each list's Show more / Show less button once on load.
export function setupToggles() {
  for (const [listId, toggleId] of COLLAPSIBLE_LISTS) {
    const toggle = document.getElementById(toggleId);
    const listEl = document.getElementById(listId);
    if (!toggle || !listEl) continue;

    toggle.addEventListener("click", () => {
      setExpanded(listId, toggleId, !listEl.classList.contains("expanded"));
    });
  }
}
