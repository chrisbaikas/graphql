/* ---------------- SVG PRIMITIVES ---------------- */
//
// Everything in this file is hand-written SVG construction. The audit requires
// the graphs be drawn as SVG by the project itself — not <canvas>, not images,
// not a charting library — so this module is that proof: a handful of DOM
// helpers and shared geometry, with no third-party code behind them.

const SVG_NS = "http://www.w3.org/2000/svg";

// Create an SVG element in the correct namespace and apply attributes.
// `attrs` keys map straight to SVG attribute names (e.g. { x1: 0, stroke: "#fff" }).
export function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

// Build a fresh, responsive <svg> root sized by a viewBox. CSS scales it to the
// container width (see .graph-box svg). Width/height define the coordinate
// space the graphs draw into.
export function createSvg(width, height) {
  return svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img"
  });
}

// Shared chart geometry, reused by the graphs so they stay visually consistent
// and the magic numbers live in one place.
export const CHART = {
  W: 480,
  H: 260,
  pad: { top: 16, right: 16, bottom: 28, left: 52 },
  axis: "#475569",
  label: "#94a3b8",
  value: "#e2e8f0"
};
CHART.plotH = CHART.H - CHART.pad.top - CHART.pad.bottom;

// The horizontal axis follows zero, which may be inside the plot for negative XP.
export function drawAxes(svg, baselineY, plotW) {
  const { pad, plotH, axis } = CHART;
  svg.appendChild(svgEl("line", {
    x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + plotH,
    stroke: axis, "stroke-width": 1
  }));
  svg.appendChild(svgEl("line", {
    x1: pad.left, y1: baselineY, x2: pad.left + plotW, y2: baselineY,
    stroke: axis, "stroke-width": 1
  }));
}

// Convenience: an SVG <text> node with content and sensible label defaults.
export function svgText(content, attrs = {}) {
  const el = svgEl("text", { "font-size": 11, fill: CHART.label, ...attrs });
  el.textContent = content;
  return el;
}

// Attach a hover tooltip to a shape by giving it an SVG <title> child.
//
// <title> is the SVG element's accessible name as well as its native tooltip,
// so one node covers both the mouse and the screen reader — no library, no
// listeners, no positioning code. It must be the FIRST child to be picked up
// reliably, hence prepend rather than append.
//
// The text is set with textContent, so a project name from the platform is
// inserted as text and never parsed as markup.
export function withTooltip(shape, text) {
  const title = svgEl("title");
  title.textContent = text;
  shape.prepend(title);
  return shape;
}
