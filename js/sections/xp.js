// Section 2: total XP, the current level, and the transactions the total is
// summed from. The XP rows come from the same request the XP graph uses; the
// level is a separate query (its own transaction type).

import { XP_VISIBLE } from "../config.js";
import { fetchLevel, fetchXpBreakdown } from "../data/profile.js";
import { applyOverflow, resetOverflow } from "../ui/collapsible.js";
import { formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadXpSection() {
  // The level is its own query, so it is loaded on its own errand: a failure
  // there should leave the XP total and its list standing rather than blanking
  // the whole card. loadLevel() handles its own errors and never rejects, so
  // starting it without awaiting leaves nothing unhandled behind.
  loadLevel();

  const totalEl = document.getElementById("xp-total");
  const countEl = document.getElementById("xp-count");
  const listEl = document.getElementById("xp-list");

  const session = currentSession();

  try {
    const rows = await fetchXpBreakdown();
    if (!isCurrentSession(session)) return;

    const totalXp = rows.reduce((sum, r) => sum + r.amount, 0);
    if (totalEl) totalEl.textContent = formatXp(totalXp);
    if (countEl) countEl.textContent = String(rows.length);

    if (!listEl) return;
    listEl.innerHTML = "";
    resetOverflow("xp-list", "xp-toggle");

    if (!rows.length) {
      listEl.innerHTML = "<li>No XP yet.</li>";
      return;
    }

    // The total above is just the sum of these rows, so listing them lets the
    // figure be checked line by line against the platform's own XP board.
    for (const row of rows) {
      const li = document.createElement("li");
      li.className = "xp-item";
      // textContent, not innerHTML: the name is derived from platform data.
      li.textContent = `${row.name} — ${formatXp(row.amount)}`;
      listEl.appendChild(li);
    }

    applyOverflow("xp-list", "xp-toggle", ".xp-item", XP_VISIBLE);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    if (totalEl) totalEl.textContent = "—";
    if (countEl) countEl.textContent = "—";
    if (listEl) {
      listEl.innerHTML = "<li>—</li>";
      resetOverflow("xp-list", "xp-toggle");
    }
    reportSectionError("Could not load XP", err);
  }
}

async function loadLevel() {
  const levelEl = document.getElementById("xp-level");
  if (!levelEl) return;

  const session = currentSession();

  try {
    const level = await fetchLevel();
    if (!isCurrentSession(session)) return;
    // A user with no level transactions yet keeps the placeholder rather than
    // being shown a misleading "0".
    levelEl.textContent = level === null ? "—" : String(level);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    levelEl.textContent = "—";
    reportSectionError("Could not load level", err);
  }
}
