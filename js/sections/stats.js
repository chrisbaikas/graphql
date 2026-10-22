// Section 4: statistics container. Draws the SVG graphs — XP over time into
// #graph-xp, audit ratio into #graph-audit, XP by project into #graph-projects.
// Each graph handles its own errors independently.

import { drawXpGraph } from "../charts/xpGraph.js";
import { drawAuditGraph } from "../charts/auditGraph.js";
import { drawProjectsGraph } from "../charts/projectsGraph.js";

export function loadStatsSection() {
  // Start all graphs together; each loader handles its own errors.
  return Promise.all([
    drawXpGraph(),
    drawAuditGraph(),
    drawProjectsGraph()
  ]);
}
