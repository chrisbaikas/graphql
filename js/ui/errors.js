/* ---------------- ERROR REPORTING ---------------- */

import { SilentError } from "../core/session.js";

// Route errors to the visible view. Dashboard errors accumulate because
// sections load independently and can each fail.

// Report a section's failure. A SilentError means the session ended — that is
// already reported (or deliberately silent), and prefixing it with "Could not
// load X" would just bury the real message under six copies of itself.
export function reportSectionError(prefix, err) {
  if (err instanceof SilentError) {
    showError(err.message);
    return;
  }
  showError(`${prefix}: ${err.message}`);
}

export function showError(message) {
  if (!message) return;
  const dashboardView = document.getElementById("dashboard-view");
  const onDashboard = dashboardView && dashboardView.style.display === "block";

  if (onDashboard) {
    const box = document.getElementById("dashboard-error");
    if (!box) return;
    const existing = box.textContent ? `${box.textContent}\n` : "";
    box.textContent = `${existing}${message}`;
    box.hidden = false;
    return;
  }

  const errorText = document.getElementById("error");
  if (errorText) errorText.textContent = message;
}

// Wipe the dashboard error banner — called before each profile load so stale
// failures don't survive a successful retry.
export function clearDashboardError() {
  const box = document.getElementById("dashboard-error");
  if (!box) return;
  box.textContent = "";
  box.hidden = true;
}
