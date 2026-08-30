/* ---------------- SVG GRAPH #2: audit XP done vs received ---------------- */

import { CHART, createSvg, drawAxes, svgEl, svgText } from "./svg.js";
import { fetchAuditTotals } from "../data/profile.js";
import { formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

// Vertical bar chart — a deliberately different chart type from the line chart,
// as the audit requires. Shares its totals with the audit card via the cache.
export async function drawAuditGraph() {
  const box = document.getElementById("graph-audit");
  if (!box) return;

  const session = currentSession();

  try {
    const { done, received } = await fetchAuditTotals();
    if (!isCurrentSession(session)) return;

    if (done === 0 && received === 0) {
      box.innerHTML = '<p class="graph-placeholder">No audit data yet.</p>';
      return;
    }

    const bars = [
      { label: "Done", value: done, color: "#22c55e" },
      { label: "Received", value: received, color: "#f97316" }
    ];

    const { pad, plotW, plotH } = CHART;
    const max = Math.max(done, received) || 1;

    const svg = createSvg(CHART.W, CHART.H);
    svg.setAttribute("aria-label", "Audit XP done vs received");
    drawAxes(svg);

    // Bars, each with a value label above and a category label below.
    const slot = plotW / bars.length;
    const barW = slot * 0.5;
    bars.forEach((bar, i) => {
      const h = (bar.value / max) * plotH;
      const x = pad.left + i * slot + (slot - barW) / 2;
      const y = pad.top + plotH - h;

      svg.appendChild(svgEl("rect", {
        x, y, width: barW, height: h, fill: bar.color, rx: 3
      }));
      svg.appendChild(svgText(formatXp(bar.value), {
        x: x + barW / 2, y: y - 5, "text-anchor": "middle", fill: CHART.value
      }));
      svg.appendChild(svgText(bar.label, {
        x: x + barW / 2, y: pad.top + plotH + 16, "text-anchor": "middle"
      }));
    });

    box.innerHTML = "";
    box.appendChild(svg);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    box.innerHTML = '<p class="graph-placeholder">Could not load audit graph.</p>';
    reportSectionError("Could not load audit graph", err);
  }
}
