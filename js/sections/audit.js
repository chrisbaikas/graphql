// Section 3: audit ratio (XP given vs received), matching the platform
// profile's "Done" (up) / "Received" (down) figures.

import { fetchAuditTotals } from "../data/profile.js";
import { formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";

export async function loadAuditSection() {
  const doneEl = document.getElementById("audit-done");
  const receivedEl = document.getElementById("audit-received");
  const ratioEl = document.getElementById("audit-ratio");

  try {
    const { done, received } = await fetchAuditTotals();
    const ratio = received > 0 ? (done / received).toFixed(1) : "—";

    if (doneEl) doneEl.textContent = formatXp(done);
    if (receivedEl) receivedEl.textContent = formatXp(received);
    if (ratioEl) ratioEl.textContent = ratio;
  } catch (err) {
    if (doneEl) doneEl.textContent = "—";
    if (receivedEl) receivedEl.textContent = "—";
    if (ratioEl) ratioEl.textContent = "—";
    reportSectionError("Could not load audit ratio", err);
  }
}
