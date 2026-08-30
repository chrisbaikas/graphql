// Section 4: statistics container. Draws the SVG graphs — XP over time into
// #graph-xp, audit ratio into #graph-audit, XP by project into #graph-projects.
// Each graph handles its own errors independently.

import { drawXpGraph } from "../charts/xpGraph.js";
import { drawAuditGraph } from "../charts/auditGraph.js";
import { drawProjectsGraph } from "../charts/projectsGraph.js";

export async function loadStatsSection() {
  // Started together rather than awaited one after another: nothing here needs
  // an earlier graph's result, and awaiting in sequence made the project-XP
  // request wait on two unrelated draws before it was even sent. Each function
  // already handles its own errors, so none of these promises rejects and
  // Promise.all() simply resolves when the last graph is drawn.
  await Promise.all([
    drawXpGraph(),
    drawAuditGraph(),
    drawProjectsGraph()
  ]);
}
