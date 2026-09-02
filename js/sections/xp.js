// Section 2: total XP, plus the transactions it is summed from.
// Summed from the xp-type transactions the XP graph also uses — one request.

import { XP_VISIBLE } from "../config.js";
import { fetchXpBreakdown } from "../data/profile.js";
import { applyOverflow, resetOverflow } from "../ui/collapsible.js";
import { formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadXpSection() {
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
