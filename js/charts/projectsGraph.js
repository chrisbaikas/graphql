/* ---------------- SVG GRAPH #3: XP by project ---------------- */

import { CHART, createSvg, svgEl, svgText, withTooltip } from "./svg.js";
import { PROJECTS_VISIBLE } from "../config.js";
import { fetchProjectXp } from "../data/profile.js";
import { formatXp, truncate } from "../ui/format.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

// A third chart type: the other two run vertically, and project names are long,
// so bars grow left-to-right with the label in the gutter beside each one.

// Every project with XP, held here so the graph can be redrawn at a different
// length when expanded. An SVG can't be collapsed with a CSS class the way a
// list can, so expanding redraws rather than hiding rows.
let allProjects = [];

// Drop the cached project data so a logout can't leave one user's projects
// available to the next render.
export function resetProjectsCache() {
  allProjects = [];
}

export async function drawProjectsGraph() {
  const box = document.getElementById("graph-projects");
  if (!box) return;

  const session = currentSession();

  try {
    const projects = await fetchProjectXp();
    // Only adopt the rows if they still belong to the live session — assigning
    // first would leave a logged-out user's projects in module state.
    if (!isCurrentSession(session)) return;
    allProjects = projects;

    if (!allProjects.length) {
      box.innerHTML = '<p class="graph-placeholder">No project XP yet.</p>';
      hideToggle();
      return;
    }

    renderProjectsGraph(false);
  } catch (err) {
    if (!isCurrentSession(session)) return;
    box.innerHTML = '<p class="graph-placeholder">Could not load project graph.</p>';
    hideToggle();
    reportSectionError("Could not load project graph", err);
  }
}

function hideToggle() {
  const toggle = document.getElementById("projects-toggle");
  if (toggle) toggle.hidden = true;
}

// Draw the XP-by-project bars: the top PROJECTS_VISIBLE, or all of them when
// `expanded`. Keeps the toggle's label and state in sync.
export function renderProjectsGraph(expanded) {
  const box = document.getElementById("graph-projects");
  const toggle = document.getElementById("projects-toggle");
  if (!box) return;

  const projects = expanded
    ? allProjects
    : allProjects.slice(0, PROJECTS_VISIBLE);

  if (toggle) {
    const hidden = allProjects.length - PROJECTS_VISIBLE;
    toggle.hidden = hidden <= 0;
    if (hidden > 0) {
      toggle.textContent = expanded ? "Show less" : `Show ${hidden} more`;
    }
    // Always written, even while hidden: setupProjectsToggle() reads this
    // attribute back to decide the next click's direction, so a value left
    // over from a previous render would flip the toggle the wrong way.
    toggle.setAttribute("aria-expanded", String(expanded));
  }

  try {
    // Local geometry: a wider left gutter than CHART.pad gives, because project
    // names sit there. Height grows with the row count so bars keep a readable
    // thickness at any length — collapsed to a few rows or expanded to all.
    const padLeft = 132;
    // The longest bar spans the full plot width, so the gutter must fit its
    // value label ("200.00 kB" ~ 56px at font-size 11) plus the 6px gap.
    const padRight = 72;
    const padTop = 12;
    const padBottom = 24;
    const rowH = 26;
    const width = CHART.W;
    const height = padTop + padBottom + projects.length * rowH;
    const plotW = width - padLeft - padRight;

    const max = projects.reduce((value, project) => Math.max(value, project.amount), 0);
    const min = projects.reduce((value, project) => Math.min(value, project.amount), 0);
    const span = max - min || 1;
    const sx = (value) => padLeft + ((value - min) / span) * plotW;
    const baseline = sx(0);

    const svg = createSvg(width, height);
    svg.setAttribute("aria-label", "XP earned per project");
    box.setAttribute("aria-description", projects.map((project) => `${project.name}: ${formatXp(project.amount)}`).join("; "));

    // Only a vertical baseline here — a horizontal bar chart has no x axis line
    // to speak of, and the value labels carry the scale.
    svg.appendChild(svgEl("line", {
      x1: baseline, y1: padTop, x2: baseline, y2: padTop + projects.length * rowH,
      stroke: CHART.axis, "stroke-width": 1
    }));

    const barH = rowH * 0.6;
    projects.forEach((project, i) => {
      const y = padTop + i * rowH + (rowH - barH) / 2;
      const w = Math.abs(sx(project.amount) - baseline);
      const x = Math.min(sx(project.amount), baseline);

      // Grows out from the axis. `transform-origin` is a presentation
      // attribute rather than an inline style so the CSP's `style-src 'self'`
      // does not block it; .bar-grow-x in the stylesheet carries the animation
      // and inherits the existing reduced-motion opt-out.
      const rect = svgEl("rect", {
        x, y, width: w, height: barH, fill: "#38bdf8", rx: 3,
        class: "bar-grow-x",
        "transform-origin": `${baseline} ${y + barH / 2}`
      });
      // The full name, not the truncated label: the gutter text may be cut
      // short, so hovering is how a long project name is read in full.
      withTooltip(rect, `${project.name}: ${formatXp(project.amount)}`);
      svg.appendChild(rect);

      // Project name in the left gutter, vertically centred on its bar.
      svg.appendChild(svgText(truncate(project.name, 18), {
        x: padLeft - 8, y: y + barH / 2,
        "text-anchor": "end", "dominant-baseline": "middle",
        "data-max-width": padLeft - 16
      }));

      // XP value just past the end of the bar.
      svg.appendChild(svgText(formatXp(project.amount), {
        x: Math.max(sx(project.amount), baseline) + 6, y: y + barH / 2,
        "dominant-baseline": "middle", fill: CHART.value, "data-max-width": padRight - 8
      }));
    });

    box.innerHTML = "";
    box.appendChild(svg);
    // SVG text has no ellipsis layout. Fit unusually wide glyphs/large values
    // after insertion so labels stay inside their measured gutters.
    for (const text of svg.querySelectorAll("text[data-max-width]")) {
      const width = Number(text.getAttribute("data-max-width"));
      if (text.getComputedTextLength() > width) {
        text.setAttribute("textLength", width);
        text.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    }
  } catch (err) {
    box.innerHTML = '<p class="graph-placeholder">Could not draw project graph.</p>';
    reportSectionError("Could not draw project graph", err);
  }
}

// Wire the XP-by-project graph's Show more / Show less button.
export function setupProjectsToggle() {
  const toggle = document.getElementById("projects-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    renderProjectsGraph(toggle.getAttribute("aria-expanded") !== "true");
  });
}
