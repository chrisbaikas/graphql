/* ---------------- SVG GRAPH #1: cumulative XP over time ---------------- */

import { CHART, createSvg, drawAxes, svgEl, svgText } from "./svg.js";
import { fetchXpTransactions } from "../data/profile.js";
import { formatDate, formatXp } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

// Line chart. Shares its rows with the XP total card via the data layer's
// per-load cache, so drawing this costs no extra request.
export async function drawXpGraph() {
  const box = document.getElementById("graph-xp");
  if (!box) return;

  const session = currentSession();

  try {
    const transactions = await fetchXpTransactions();
    if (!isCurrentSession(session)) return;

    if (transactions.length < 2) {
      box.innerHTML = '<p class="graph-placeholder">Not enough XP data yet.</p>';
      return;
    }

    // Build cumulative-XP points: x = time (ms), y = running total.
    let running = 0;
    const points = transactions.map((t) => {
      running += t.amount || 0;
      return { x: new Date(t.createdAt).getTime(), y: running };
    });

    const { pad, plotW, plotH } = CHART;
    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    // The running total is usually monotonic, so the last point is the largest —
    // but a negative XP correction would break that and push earlier points
    // above the plot area, so take the real maximum.
    const yMax = Math.max(...points.map((p) => p.y));
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax || 1;

    const sx = (x) => pad.left + ((x - xMin) / xSpan) * plotW;
    const sy = (y) => pad.top + plotH - (y / ySpan) * plotH;

    const svg = createSvg(CHART.W, CHART.H);
    svg.setAttribute("aria-label", "Cumulative XP over time");
    drawAxes(svg);

    // Y axis labels (0 and max)
    svg.appendChild(svgText("0", {
      x: pad.left - 6, y: pad.top + plotH,
      "text-anchor": "end", "dominant-baseline": "middle"
    }));
    svg.appendChild(svgText(formatXp(yMax), {
      x: pad.left - 6, y: pad.top,
      "text-anchor": "end", "dominant-baseline": "middle"
    }));

    // X axis labels (first and last date)
    svg.appendChild(svgText(formatDate(xMin), {
      x: pad.left, y: pad.top + plotH + 16, "text-anchor": "start"
    }));
    svg.appendChild(svgText(formatDate(xMax), {
      x: pad.left + plotW, y: pad.top + plotH + 16, "text-anchor": "end"
    }));

    // The cumulative line
    const polyPoints = points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");
    svg.appendChild(svgEl("polyline", {
      points: polyPoints, fill: "none", stroke: "#38bdf8", "stroke-width": 2
    }));

    box.innerHTML = "";
    box.appendChild(svg);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    box.innerHTML = '<p class="graph-placeholder">Could not load XP graph.</p>';
    reportSectionError("Could not load XP graph", err);
  }
}
