/* ---------------- SVG GRAPH #1: cumulative XP over time ---------------- */

import { CHART, createSvg, drawAxes, svgEl, svgText, withTooltip } from "./svg.js";
import { showGraph, showGraphPlaceholder } from "./display.js";
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
      showGraphPlaceholder(box, "Not enough XP data yet.");
      return;
    }

    showGraph(box, (width) => renderXpGraph(transactions, width));
  } catch (err) {
    if (!isCurrentSession(session)) return;
    showGraphPlaceholder(box, "Could not load XP graph.");
    reportSectionError("Could not load XP graph", err);
  }
}

function renderXpGraph(transactions, width) {
  // Build cumulative-XP points: x = time (ms), y = running total.
  let running = 0;
  const points = transactions.map((t) => {
    running += t.amount;
    return { x: new Date(t.createdAt).getTime(), y: running };
  });

  const { pad, plotH } = CHART;
  const plotW = width - pad.left - pad.right;
  const xMin = points[0].x;
  const xMax = points[points.length - 1].x;
  // The running total is usually monotonic, so the last point is the largest —
  // but a negative XP correction would break that and push earlier points
  // above the plot area, so take the real maximum.
  const yMax = points.reduce((max, p) => Math.max(max, p.y), 0);
  const yMin = points.reduce((min, p) => Math.min(min, p.y), 0);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const sx = (x) => pad.left + ((x - xMin) / xSpan) * plotW;
  const sy = (y) => pad.top + plotH - ((y - yMin) / ySpan) * plotH;

  const svg = createSvg(width, CHART.H);
  svg.setAttribute("aria-label", "Cumulative XP over time");
  svg.setAttribute("aria-description", `${formatXp(running)} total XP, ${formatDate(xMin)} to ${formatDate(xMax)}.`);
  drawAxes(svg, sy(0), plotW);

  // Include negative corrections in the visible range too.
  svg.appendChild(svgText(formatXp(yMin), {
    x: pad.left + 4, y: pad.top + plotH - 6,
    "text-anchor": "start"
  }));
  svg.appendChild(svgText(formatXp(yMax), {
    x: pad.left + 4, y: pad.top + 12,
    "text-anchor": "start"
  }));

  // X axis labels (first and last date)
  svg.appendChild(svgText(formatDate(xMin), {
    x: pad.left, y: pad.top + plotH + 16, "text-anchor": "start"
  }));
  svg.appendChild(svgText(formatDate(xMax), {
    x: pad.left + plotW, y: pad.top + plotH + 16, "text-anchor": "end"
  }));

  // The cumulative line. `pathLength: 1` normalises the stroke length so the
  // draw-on animation in the stylesheet can use a dash offset of 1 without
  // knowing how long this particular line actually is.
  const polyPoints = points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");
  svg.appendChild(svgEl("polyline", {
    points: polyPoints, fill: "none", stroke: "#38bdf8", "stroke-width": 2,
    pathLength: 1, class: "line-draw"
  }));

  // Hover targets along the line. Only a sample is drawn: a transaction list
  // can run to hundreds of rows, and one circle each would both clutter the
  // chart and add hundreds of nodes for no gain. Every point is still in the
  // line itself — these are just the readable checkpoints, and the last one
  // is always included so the final total can be inspected.
  const MAX_DOTS = 24;
  const step = Math.max(1, Math.ceil(points.length / MAX_DOTS));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  for (const point of sampled) {
    const dot = svgEl("circle", {
      cx: sx(point.x), cy: sy(point.y), r: 3,
      fill: "#38bdf8", class: "dot-fade"
    });
    withTooltip(dot, `${formatDate(point.x)}: ${formatXp(point.y)} total`);
    svg.appendChild(dot);
  }

  return svg;
}
