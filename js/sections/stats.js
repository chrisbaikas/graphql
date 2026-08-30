// Section 4: statistics container. Draws the SVG graphs — XP over time into
// #graph-xp, audit ratio into #graph-audit, XP by project into #graph-projects.
// Each graph handles its own errors independently.

import { drawXpGraph } from "../charts/xpGraph.js";
import { drawAuditGraph } from "../charts/auditGraph.js";
import { drawProjectsGraph } from "../charts/projectsGraph.js";

export async function loadStatsSection() {
  await drawXpGraph();
  await drawAuditGraph();
  await drawProjectsGraph();
}
