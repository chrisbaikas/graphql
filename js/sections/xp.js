// Section 2: total XP.
// Summed from the xp-type transactions the XP graph also uses — one request.

import { fetchTotalXp } from "../data/profile.js";
import { formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadXpSection() {
  const totalEl = document.getElementById("xp-total");

  const session = currentSession();

  try {
    const totalXp = await fetchTotalXp();
    if (!isCurrentSession(session)) return;
    if (totalEl) totalEl.textContent = formatXp(totalXp);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    if (totalEl) totalEl.textContent = "—";
    reportSectionError("Could not load XP", err);
  }
}
