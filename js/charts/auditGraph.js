/* ---------------- SVG GRAPH #2: audit XP done vs received ---------------- */

import { CHART, createSvg, drawAxes, svgEl, svgText, withTooltip } from "./svg.js";
import { showGraph, showGraphPlaceholder } from "./display.js";
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
      showGraphPlaceholder(box, "No audit data yet.");
      return;
    }

    showGraph(box, (width) => renderAuditGraph(done, received, width));
  } catch (err) {
    if (!isCurrentSession(session)) return;
    showGraphPlaceholder(box, "Could not load audit graph.");
    reportSectionError("Could not load audit graph", err);
  }
}

function renderAuditGraph(done, received, width) {
  const bars = [
    { label: "Done", value: done, color: "#22c55e" },
    { label: "Received", value: received, color: "#f97316" }
  ];

  const { pad, plotH } = CHART;
  const plotW = width - pad.left - pad.right;
  const max = Math.max(0, done, received);
  const min = Math.min(0, done, received);
  const span = max - min || 1;
  const sy = (value) => pad.top + ((max - value) / span) * plotH;
  const baseline = sy(0);

  const svg = createSvg(width, CHART.H);
  svg.setAttribute("aria-label", "Audit XP done vs received");
  svg.setAttribute("aria-description", `Done: ${formatXp(done)}. Received: ${formatXp(received)}.`);
  drawAxes(svg, baseline, plotW);

  // Bars, each with a value label above and a category label below.
  const slot = plotW / bars.length;
  const barW = slot * 0.5;
  bars.forEach((bar, i) => {
    const h = Math.abs(sy(bar.value) - baseline);
    const x = pad.left + i * slot + (slot - barW) / 2;
    const y = Math.min(sy(bar.value), baseline);

    // The bar grows up from the baseline. `transform-origin` is set as a
    // presentation ATTRIBUTE, not an inline style: `style-src 'self'` in the
    // CSP blocks inline style attributes, and a presentation attribute is not
    // one. The animation itself lives in the stylesheet (.bar-grow), so the
    // reduced-motion rule already there switches it off.
    const rect = svgEl("rect", {
      x, y, width: barW, height: h, fill: bar.color, rx: 3,
      class: "bar-grow",
      "transform-origin": `${x + barW / 2} ${baseline}`
    });
    const share = done >= 0 && received >= 0 && done + received > 0
      ? Math.round((bar.value / (done + received)) * 100)
      : null;
    withTooltip(rect, `${bar.label}: ${formatXp(bar.value)}${share === null ? "" : ` (${share}%)`}`);
    svg.appendChild(rect);
    svg.appendChild(svgText(formatXp(bar.value), {
      x: x + barW / 2, y: Math.max(12, y - 5), "text-anchor": "middle", fill: CHART.value
    }));
    svg.appendChild(svgText(bar.label, {
      x: x + barW / 2, y: pad.top + plotH + 16, "text-anchor": "middle"
    }));
  });

  return svg;
}
