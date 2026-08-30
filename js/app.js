/* ---------------- CONFIG ---------------- */
// Zone01 platform domain. Used for both auth (signin) and GraphQL.
const DOMAIN = "platform.zone01.gr";
const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");

const errorText = document.getElementById("error");

// How many rows each collapsible list shows before offering "Show more".
// Declared up here because the routing below runs immediately on load and
// reaches resetAllOverflow() — a `const` further down would still be in its
// temporal dead zone at that point.
const SKILLS_VISIBLE = 6;
const RECENT_VISIBLE = 5;
const PROJECTS_VISIBLE = 8;

// Every CSS-collapsible list on the dashboard: [listId, toggleId]. The project
// graph isn't here — an SVG is redrawn rather than collapsed with a class.
const COLLAPSIBLE_LISTS = [
  ["skills-list", "skills-toggle"],
  ["recent-list", "recent-toggle"],
];

// Route on load: a valid, unexpired token keeps the user on the dashboard;
// a missing or expired/invalid token sends them to login (auto-logout).
const storedToken = localStorage.getItem("token");

if (storedToken && !isTokenExpired(storedToken)) {
  showDashboard();
} else {
  logout(); // clears any stale/expired token and shows the login view
}

function showLogin() {
  loginView.style.display = "block";
  dashboardView.style.display = "none";
}

function showDashboard() {
  loginView.style.display = "none";
  dashboardView.style.display = "block";
  loadProfile();
}

/* ---------------- PROFILE ---------------- */

// Loads every dashboard section. Each section loader handles its own errors so
// one failing query doesn't blank the whole profile.
function loadProfile() {
  showLoading();
  loadUserSection();
  loadXpSection();
  loadGradesSection();
  loadRecentSection();
  loadSkillsSection();
  loadStatsSection();
}

// Show a "Loading…" hint in every value slot until each section's data arrives.
function showLoading() {
  const profile = document.getElementById("profile");
  if (!profile) return;
  for (const dd of profile.querySelectorAll(".info dd")) {
    dd.textContent = "Loading…";
  }
  const recent = document.getElementById("recent-list");
  if (recent) recent.innerHTML = "<li>Loading…</li>";
  const skills = document.getElementById("skills-list");
  if (skills) skills.innerHTML = "<li>Loading…</li>";
  resetAllOverflow();
  for (const box of profile.querySelectorAll(".graph-box")) {
    box.innerHTML = '<p class="graph-placeholder">Loading…</p>';
  }
}

// Ticket 5 — Section 1: basic user identification.
// Ticket 8 — this is the app's NORMAL query: `{ user { id login } }`.
async function loadUserSection() {
  const loginEl = document.getElementById("user-login");
  const idEl = document.getElementById("user-id");

  try {
    const data = await graphqlRequest(`{ user { id login } }`);
    const user = data.user && data.user[0];
    if (!user) throw new Error("No user data returned.");

    if (loginEl) loginEl.textContent = user.login;
    if (idEl) idEl.textContent = user.id;
  } catch (err) {
    if (loginEl) loginEl.textContent = "—";
    if (idEl) idEl.textContent = "—";
    showError(`Could not load user info: ${err.message}`);
  }
}

// Ticket 6 — Section 2: total XP.
// Uses a "with arguments" query (where: type _eq "xp") so only xp-type
// transactions are summed — no level/up/down noise.
async function loadXpSection() {
  const totalEl = document.getElementById("xp-total");

  try {
    const data = await graphqlRequest(
      `{ transaction(where: { type: { _eq: "xp" } }) { amount } }`
    );
    const transactions = data.transaction || [];
    const totalXp = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    if (totalEl) totalEl.textContent = formatXp(totalXp);
  } catch (err) {
    if (totalEl) totalEl.textContent = "—";
    showError(`Could not load XP: ${err.message}`);
  }
}

// The platform reports XP in bytes. Render it human-readably (kB / MB) so the
// number matches how the platform profile presents it.
function formatXp(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} kB`;
  return `${bytes} B`;
}

// Format a timestamp (ms) as DD/MM/YYYY — fixed order, not locale-dependent
// (toLocaleDateString would show MM/DD/YYYY in a US-locale browser).
function formatDate(ms) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Fetch audit XP totals once: XP given to others (Done = "up") and received
// from others (Received = "down"). Shared by the audit section (T7) and the
// audit graph (T11) so the up/down query runs a single time.
// Uses a "with arguments" GraphQL query.
async function fetchAuditTotals() {
  const data = await graphqlRequest(
    `{ transaction(where: { type: { _in: ["up", "down"] } }) { type amount } }`
  );
  const transactions = data.transaction || [];
  let done = 0;
  let received = 0;
  for (const t of transactions) {
    if (t.type === "up") done += t.amount || 0;
    else if (t.type === "down") received += t.amount || 0;
  }
  return { done, received };
}

// Ticket 7 — Section 3: audit ratio (XP given vs received), matching the
// platform profile's "Done" (up) / "Received" (down) figures.
async function loadGradesSection() {
  const doneEl = document.getElementById("audit-done");
  const receivedEl = document.getElementById("audit-received");
  const ratioEl = document.getElementById("audit-ratio");

  try {
    const { done, received } = await fetchAuditTotals();
    const ratio = received > 0 ? (done / received).toFixed(1) : "—";

    if (doneEl) doneEl.textContent = formatXp(done);
    if (receivedEl) receivedEl.textContent = formatXp(received);
    if (ratioEl) ratioEl.textContent = ratio;
  } catch (err) {
    if (doneEl) doneEl.textContent = "—";
    if (receivedEl) receivedEl.textContent = "—";
    if (ratioEl) ratioEl.textContent = "—";
    showError(`Could not load audit ratio: ${err.message}`);
  }
}

// Ticket 8 — the app's NESTED query. Fetches the latest project results and,
// nested inside each, the related `object` (its name and type). Also doubles as
// a small "recent projects" list, so the nesting earns its place in the UI.
async function loadRecentSection() {
  const listEl = document.getElementById("recent-list");

  try {
    const data = await graphqlRequest(`{
      result(
        where: { object: { type: { _eq: "project" } } }
        order_by: { createdAt: desc }
        limit: 30
      ) {
        grade
        object {
          name
          type
        }
      }
    }`);
    const results = data.result || [];

    if (!listEl) return;
    listEl.innerHTML = "";
    resetOverflow("recent-list", "recent-toggle");

    if (!results.length) {
      listEl.innerHTML = "<li>No projects yet.</li>";
      return;
    }

    for (const r of results) {
      const name = (r.object && r.object.name) || "Unknown";
      const status = r.grade >= 1 ? "pass" : "fail";
      const li = document.createElement("li");
      li.className = "recent-item";
      li.textContent = `${name} — ${status}`;
      listEl.appendChild(li);
    }

    applyOverflow("recent-list", "recent-toggle", ".recent-item", RECENT_VISIBLE);
  } catch (err) {
    if (listEl) listEl.innerHTML = "<li>—</li>";
    resetOverflow("recent-list", "recent-toggle");
    showError(`Could not load recent projects: ${err.message}`);
  }
}

// Ticket 14 (bonus) — Skills breakdown: extra information beyond the three
// mandatory sections. The platform records skills as transactions whose `type`
// is prefixed `skill_` (e.g. `skill_go`, `skill_prog`), where `amount` is a
// percentage rather than XP. A skill is re-recorded as it improves, so the
// CURRENT level is the highest amount seen for that type — not the sum.
//
// Defensive by design: `skill_%` is matched with `_like`, so if this platform
// exposes no skill rows at all the card shows an empty state instead of an
// error. Uses a "with arguments" query.
async function loadSkillsSection() {
  const listEl = document.getElementById("skills-list");
  if (!listEl) return;

  try {
    const data = await graphqlRequest(`{
      transaction(
        where: { type: { _like: "skill_%" } }
        order_by: { amount: desc }
      ) {
        type
        amount
      }
    }`);
    const transactions = data.transaction || [];

    // Highest amount per skill type — ordered desc above, so the first row for
    // a given type is already its peak.
    const best = new Map();
    for (const t of transactions) {
      if (!best.has(t.type)) best.set(t.type, t.amount || 0);
    }

    const skills = [...best.entries()]
      .map(([type, amount]) => ({ name: formatSkillName(type), amount }))
      .sort((a, b) => b.amount - a.amount);

    listEl.innerHTML = "";
    resetOverflow("skills-list", "skills-toggle");

    if (!skills.length) {
      listEl.innerHTML = "<li>No skill data available.</li>";
      return;
    }

    // Every skill is rendered; applyOverflow() below hides the ones past
    // SKILLS_VISIBLE behind the toggle.
    skills.forEach((skill) => {
      // Percentages are capped at 100 for the bar width only — an out-of-range
      // value would otherwise overflow the card.
      const pct = Math.max(0, Math.min(100, skill.amount));
      const li = document.createElement("li");
      li.className = "skill";

      const name = document.createElement("span");
      name.className = "skill-name";
      name.textContent = skill.name;

      const bar = document.createElement("span");
      bar.className = "skill-bar";
      const fill = document.createElement("span");
      fill.className = "skill-fill";
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const value = document.createElement("span");
      value.className = "skill-value";
      value.textContent = `${skill.amount}%`;

      li.append(name, bar, value);
      listEl.appendChild(li);
    });

    applyOverflow("skills-list", "skills-toggle", ".skill", SKILLS_VISIBLE);
  } catch (err) {
    listEl.innerHTML = "<li>—</li>";
    resetOverflow("skills-list", "skills-toggle");
    showError(`Could not load skills: ${err.message}`);
  }
}

/* ---------------- SHOW MORE / SHOW LESS ---------------- */

// Generic collapse behaviour shared by every "top N + Show more" list.
// A container is any element holding row children; rows past `visible` get the
// `extra` class and are hidden by CSS until the toggle expands them.
//
// `listId` and `toggleId` are looked up fresh each call rather than captured,
// so a list can be re-rendered (on reload, or after logout) without leaving a
// stale node reference behind.
function setExpanded(listId, toggleId, expanded, hiddenCount) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (!listEl || !toggle) return;

  listEl.classList.toggle("expanded", expanded);
  if (typeof hiddenCount === "number") toggle.dataset.hidden = hiddenCount;

  const count = toggle.dataset.hidden || "";
  toggle.textContent = expanded ? "Show less" : `Show ${count} more`;
  toggle.setAttribute("aria-expanded", String(expanded));
}

// Mark rows past `visible` as overflow and show the toggle only when some are
// actually hidden. Call after rendering a list's rows.
function applyOverflow(listId, toggleId, rowSelector, visible) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (!listEl) return;

  const rows = [...listEl.querySelectorAll(rowSelector)];
  rows.forEach((row, i) => row.classList.toggle("extra", i >= visible));

  if (!toggle) return;
  const hidden = rows.length - visible;
  if (hidden > 0) {
    setExpanded(listId, toggleId, false, hidden);
    toggle.hidden = false;
  } else {
    toggle.hidden = true;
  }
}

// Reset a collapsible list to its collapsed state and hide its toggle — used
// by the loading and logout paths so a list never returns mid-expanded.
function resetOverflow(listId, toggleId) {
  const listEl = document.getElementById(listId);
  const toggle = document.getElementById(toggleId);
  if (listEl) listEl.classList.remove("expanded");
  if (toggle) toggle.hidden = true;
}

// Collapse every list and hide the project graph's toggle too — the graph is
// redrawn rather than CSS-collapsed, so it isn't in COLLAPSIBLE_LISTS.
function resetAllOverflow() {
  for (const [listId, toggleId] of COLLAPSIBLE_LISTS) {
    resetOverflow(listId, toggleId);
  }
  const projectsToggle = document.getElementById("projects-toggle");
  if (projectsToggle) projectsToggle.hidden = true;
}

// Wire each list's Show more / Show less button once on load.
function setupToggles() {
  for (const [listId, toggleId] of COLLAPSIBLE_LISTS) {
    const toggle = document.getElementById(toggleId);
    const listEl = document.getElementById(listId);
    if (!toggle || !listEl) continue;

    toggle.addEventListener("click", () => {
      setExpanded(listId, toggleId, !listEl.classList.contains("expanded"));
    });
  }
}

// "skill_go" -> "Go", "skill_web-dev" -> "Web dev". Turns the raw transaction
// type into something readable in the UI.
function formatSkillName(type) {
  const raw = String(type).replace(/^skill_/, "").replace(/[-_]+/g, " ").trim();
  if (!raw) return type;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* ---------------- STATISTICS (SVG) ---------------- */

const SVG_NS = "http://www.w3.org/2000/svg";

// Create an SVG element in the correct namespace and apply attributes.
// `attrs` keys map straight to SVG attribute names (e.g. { x1: 0, stroke: "#fff" }).
function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

// Build a fresh, responsive <svg> root sized by a viewBox. CSS scales it to the
// container width (see .graph-box svg). Width/height define the coordinate
// space that T10/T11 draw into.
function createSvg(width, height) {
  return svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img"
  });
}

// Ticket 9 — Section 4: statistics container. Draws the SVG graphs:
// Ticket 10 (XP over time) into #graph-xp, Ticket 11 (audit ratio) into
// #graph-audit. Each graph handles its own errors independently.
async function loadStatsSection() {
  await drawXpGraph();
  await drawAuditGraph();
  await drawProjectsGraph();
}

/* ---------------- GRAPH ZOOM (modal) ---------------- */

// Click any graph box to open an enlarged copy in a modal; close with the X,
// a backdrop click, or Escape. The SVG is cloned (not moved) so the dashboard
// graph stays in place.
function setupGraphModal() {
  const modal = document.getElementById("graph-modal");
  const body = document.getElementById("modal-body");
  const closeBtn = document.getElementById("modal-close");
  if (!modal || !body || !closeBtn) return;

  function openModal(svg) {
    body.innerHTML = "";
    body.appendChild(svg.cloneNode(true));
    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
    body.innerHTML = "";
  }

  // Event-delegate: any click inside a .graph-box that contains an <svg> opens it.
  document.addEventListener("click", (e) => {
    const box = e.target.closest(".graph-box");
    if (!box) return;
    const svg = box.querySelector("svg");
    if (svg) openModal(svg);
  });

  closeBtn.addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
}

// Shared chart geometry, reused by both SVG graphs so they stay visually
// consistent and the magic numbers live in one place.
const CHART = {
  W: 480,
  H: 260,
  pad: { top: 16, right: 16, bottom: 28, left: 52 },
  axis: "#475569",
  label: "#94a3b8",
  value: "#e2e8f0"
};
CHART.plotW = CHART.W - CHART.pad.left - CHART.pad.right;
CHART.plotH = CHART.H - CHART.pad.top - CHART.pad.bottom;

// Draw the L-shaped X/Y axes into an existing <svg>. Returns nothing — callers
// add their own data marks and labels on top.
function drawAxes(svg) {
  const { pad, plotW, plotH, axis } = CHART;
  svg.appendChild(svgEl("line", {
    x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + plotH,
    stroke: axis, "stroke-width": 1
  }));
  svg.appendChild(svgEl("line", {
    x1: pad.left, y1: pad.top + plotH, x2: pad.left + plotW, y2: pad.top + plotH,
    stroke: axis, "stroke-width": 1
  }));
}

// Convenience: an SVG <text> node with content and sensible label defaults.
function svgText(content, attrs = {}) {
  const el = svgEl("text", { "font-size": 11, fill: CHART.label, ...attrs });
  el.textContent = content;
  return el;
}

// Ticket 10 — SVG Graph #1: cumulative XP over time (line chart).
async function drawXpGraph() {
  const box = document.getElementById("graph-xp");
  if (!box) return;

  try {
    const data = await graphqlRequest(`{
      transaction(
        where: { type: { _eq: "xp" } }
        order_by: { createdAt: asc }
      ) {
        amount
        createdAt
      }
    }`);
    const transactions = data.transaction || [];

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
    const yMax = points[points.length - 1].y; // cumulative, so last is largest
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
    box.innerHTML = '<p class="graph-placeholder">Could not load XP graph.</p>';
    showError(`Could not load XP graph: ${err.message}`);
  }
}

// Ticket 11 — SVG Graph #2: audit XP given (Done) vs received (Received) as a
// bar chart — a deliberately different chart type from T10's line chart.
async function drawAuditGraph() {
  const box = document.getElementById("graph-audit");
  if (!box) return;

  try {
    const { done, received } = await fetchAuditTotals();

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
    box.innerHTML = '<p class="graph-placeholder">Could not load audit graph.</p>';
    showError(`Could not load audit graph: ${err.message}`);
  }
}

// Ticket 15 (bonus) — SVG Graph #3: XP by project (horizontal bar chart).
// A third chart type: the other two run vertically, and project names are long,
// so bars grow left-to-right with the label in the gutter beside each one.
//
// Nested query: each xp transaction carries the `object` that earned it, so the
// project name comes back in the same round trip.
async function drawProjectsGraph() {
  const box = document.getElementById("graph-projects");
  if (!box) return;

  try {
    const data = await graphqlRequest(`{
      transaction(
        where: {
          type: { _eq: "xp" }
          object: { type: { _eq: "project" } }
        }
        order_by: { amount: desc }
      ) {
        amount
        object {
          name
        }
      }
    }`);
    const transactions = data.transaction || [];

    // A project can pay out more than once, so total per name rather than
    // trusting a single row.
    const totals = new Map();
    for (const t of transactions) {
      const name = (t.object && t.object.name) || "Unknown";
      totals.set(name, (totals.get(name) || 0) + (t.amount || 0));
    }

    allProjects = [...totals.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (!allProjects.length) {
      box.innerHTML = '<p class="graph-placeholder">No project XP yet.</p>';
      const toggle = document.getElementById("projects-toggle");
      if (toggle) toggle.hidden = true;
      return;
    }

    renderProjectsGraph(false);
  } catch (err) {
    box.innerHTML = '<p class="graph-placeholder">Could not load project graph.</p>';
    const toggle = document.getElementById("projects-toggle");
    if (toggle) toggle.hidden = true;
    showError(`Could not load project graph: ${err.message}`);
  }
}

// Every project with XP, kept so the graph can be redrawn at a different length
// when the user expands it. An SVG can't be collapsed with a CSS class the way
// a list can, so expanding redraws it rather than hiding rows.
let allProjects = [];

// Draw the XP-by-project bars: the top PROJECTS_VISIBLE, or all of them when
// `expanded`. Keeps the toggle's label and state in sync.
function renderProjectsGraph(expanded) {
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
      toggle.setAttribute("aria-expanded", String(expanded));
    }
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

    const max = projects[0].amount || 1;

    const svg = createSvg(width, height);
    svg.setAttribute("aria-label", "XP earned per project");

    // Only a vertical baseline here — a horizontal bar chart has no x axis line
    // to speak of, and the value labels carry the scale.
    svg.appendChild(svgEl("line", {
      x1: padLeft, y1: padTop, x2: padLeft, y2: padTop + projects.length * rowH,
      stroke: CHART.axis, "stroke-width": 1
    }));

    const barH = rowH * 0.6;
    projects.forEach((project, i) => {
      const y = padTop + i * rowH + (rowH - barH) / 2;
      const w = Math.max(1, (project.amount / max) * plotW);

      svg.appendChild(svgEl("rect", {
        x: padLeft, y, width: w, height: barH, fill: "#38bdf8", rx: 3
      }));

      // Project name in the left gutter, vertically centred on its bar.
      svg.appendChild(svgText(truncate(project.name, 18), {
        x: padLeft - 8, y: y + barH / 2,
        "text-anchor": "end", "dominant-baseline": "middle"
      }));

      // XP value just past the end of the bar.
      svg.appendChild(svgText(formatXp(project.amount), {
        x: padLeft + w + 6, y: y + barH / 2,
        "dominant-baseline": "middle", fill: CHART.value
      }));
    });

    box.innerHTML = "";
    box.appendChild(svg);
  } catch (err) {
    box.innerHTML = '<p class="graph-placeholder">Could not draw project graph.</p>';
    showError(`Could not draw project graph: ${err.message}`);
  }
}

// Wire the XP-by-project graph's Show more / Show less button. Clicking the
// button must not also open the zoom modal, so the click is stopped here
// (the modal listens for clicks anywhere inside .graph-box).
function setupProjectsToggle() {
  const toggle = document.getElementById("projects-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    renderProjectsGraph(toggle.getAttribute("aria-expanded") !== "true");
  });
}

// SVG has no text-overflow, so long project names are shortened by hand.
function truncate(text, max) {
  const str = String(text);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/* ---------------- GRAPHIQL PLAYGROUND (Ticket 16) ---------------- */

// An in-app query playground: type a query, run it against the platform
// endpoint with the logged-in user's JWT, and read the JSON back.
//
// It deliberately does NOT reuse graphqlRequest(). That helper returns only
// `data` and throws on `errors[]`, which is right for the dashboard but wrong
// here: a playground must SHOW a malformed query's error — line, column and
// all — rather than collapse it into a thrown message. So this posts directly
// and renders whatever comes back, errors included.
async function runPlaygroundQuery() {
  const queryEl = document.getElementById("gql-query");
  const varsEl = document.getElementById("gql-variables");
  const resultEl = document.getElementById("gql-result");
  const runBtn = document.getElementById("gql-run");
  const statusEl = document.getElementById("gql-status");
  if (!queryEl || !resultEl) return;

  const query = queryEl.value.trim();
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  if (!query) {
    resultEl.textContent = "Enter a query first.";
    setStatus("");
    return;
  }

  // Variables are parsed here so a JSON typo is reported as such, rather than
  // reaching the server as a confusing GraphQL error.
  let variables = {};
  const rawVars = varsEl ? varsEl.value.trim() : "";
  if (rawVars) {
    try {
      variables = JSON.parse(rawVars);
    } catch (err) {
      resultEl.textContent = `Variables are not valid JSON:\n${err.message}`;
      setStatus("Invalid variables");
      return;
    }
  }

  const jwt = localStorage.getItem("token");
  if (!jwt || isTokenExpired(jwt)) {
    logout();
    return;
  }

  if (runBtn) runBtn.disabled = true;
  setStatus("Running…");
  const startedAt = Date.now();

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({ query, variables })
    });

    // A rejected token ends the session here as it would anywhere else.
    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch {
      resultEl.textContent = "The server returned a non-JSON response.";
      setStatus("Failed");
      return;
    }

    // Render the whole envelope — `errors` and `data` alike — so a failed query
    // is as informative as a successful one.
    resultEl.textContent = JSON.stringify(result, null, 2);

    const ms = Date.now() - startedAt;
    if (result.errors && result.errors.length) {
      const count = result.errors.length;
      setStatus(`${count} error${count === 1 ? "" : "s"} · ${ms} ms`);
    } else {
      setStatus(`OK · ${ms} ms`);
    }
  } catch {
    resultEl.textContent = "Network error — could not reach the GraphQL server.";
    setStatus("Failed");
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

// Wire the playground once on load: the Run button, Ctrl/Cmd+Enter inside the
// editor, and the example-query buttons.
function setupPlayground() {
  const runBtn = document.getElementById("gql-run");
  const queryEl = document.getElementById("gql-query");
  if (!runBtn || !queryEl) return;

  runBtn.addEventListener("click", runPlaygroundQuery);

  // Ctrl+Enter (Cmd+Enter on a Mac) runs without reaching for the mouse.
  queryEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runPlaygroundQuery();
    }
  });

  // Example buttons load a query into the editor; the user still presses Run,
  // so nothing fires against the endpoint unasked.
  for (const btn of document.querySelectorAll(".gql-example")) {
    btn.addEventListener("click", () => {
      queryEl.value = btn.dataset.query || "";
      queryEl.focus();
    });
  }
}

// Clear the playground's result pane — called on logout so one user's query
// output can't linger for the next.
function resetPlayground() {
  const resultEl = document.getElementById("gql-result");
  const statusEl = document.getElementById("gql-status");
  if (resultEl) resultEl.textContent = "Run a query to see the result.";
  if (statusEl) statusEl.textContent = "";
}

/* ---------------- LOGIN ---------------- */

if (loginForm) {
  loginForm.addEventListener("submit", login);
}

async function login(event) {
  if (event) event.preventDefault();

  // Works for both "username:password" and "email:password" — the platform
  // accepts either identifier in the Basic auth header.
  const identifier = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (errorText) errorText.textContent = "";

  if (!identifier || !password) {
    showError("Please enter your username/email and password.");
    return;
  }

  const credentials = btoa(`${identifier}:${password}`);
  const submitBtn = document.getElementById("login-btn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    let response;
    try {
      response = await fetch(SIGNIN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`
        }
      });
    } catch (networkErr) {
      throw new Error("Network error — could not reach the server.");
    }

    if (!response.ok) {
      // 401/403 from signin means the credentials were rejected.
      throw new Error("Invalid credentials. Please try again.");
    }

    const jwt = cleanToken(await response.text());
    if (!jwt) {
      throw new Error("Login failed: no token returned by the server.");
    }

    localStorage.setItem("token", jwt);
    showDashboard();

  } catch (err) {
    showError(err.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// The signin endpoint returns the JWT as a quoted string (e.g. "eyJ...").
// Strip surrounding quotes/whitespace so the Bearer header is valid later.
function cleanToken(raw) {
  return raw.trim().replace(/^"+|"+$/g, "").trim();
}

function showError(message) {
  if (errorText) errorText.textContent = message;
}

/* ---------------- LOGOUT ---------------- */

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => logout());
}

// Single source of truth for ending a session. Used by the logout button and
// triggered automatically when a token is missing/expired/rejected. Clears the
// stored token and resets rendered values so no protected data lingers — but
// keeps the card structure intact so a later re-login can repopulate it.
function logout() {
  localStorage.removeItem("token");
  resetProfile();
  showLogin();
}

// Reset every rendered profile value back to its placeholder without destroying
// the DOM structure (so loadProfile() can refill it on the next login).
function resetProfile() {
  const profile = document.getElementById("profile");
  if (!profile) return;
  for (const dd of profile.querySelectorAll(".info dd")) {
    dd.textContent = "—";
  }
  const recent = document.getElementById("recent-list");
  if (recent) recent.innerHTML = "<li>—</li>";
  const skills = document.getElementById("skills-list");
  if (skills) skills.innerHTML = "<li>—</li>";
  resetAllOverflow();
  resetPlayground();
  for (const box of profile.querySelectorAll(".graph-box")) {
    box.innerHTML = '<p class="graph-placeholder">—</p>';
  }
}

/* ---------------- JWT HELPERS ---------------- */

// Decode the JWT payload (middle segment, base64url) without verifying it —
// just enough to read the `exp` claim for client-side expiry checks.
function decodeJwtPayload(jwt) {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// True if the token is malformed or its `exp` (seconds) is in the past.
function isTokenExpired(jwt) {
  const payload = decodeJwtPayload(jwt);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 <= Date.now();
}

/* ---------------- GRAPHQL SERVICE ---------------- */

// The single entry point for every GraphQL call in the app. Sends the query
// (and optional variables) to the endpoint with Bearer auth and returns the
// `data` object. On any auth failure it logs the user out; on any other failure
// it throws an Error with a readable message (callers handle the rejection).
async function graphqlRequest(query, variables = {}) {
  const jwt = localStorage.getItem("token");

  // No usable token — end the session before we even hit the network.
  if (!jwt || isTokenExpired(jwt)) {
    logout();
    throw new Error("Your session has expired. Please log in again.");
  }

  let response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({ query, variables })
    });
  } catch {
    throw new Error("Network error — could not reach the GraphQL server.");
  }

  // The server rejected the token (expired/revoked) — force a logout.
  if (response.status === 401 || response.status === 403) {
    logout();
    throw new Error("Your session is no longer valid. Please log in again.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Received an invalid response from the GraphQL server.");
  }

  // GraphQL reports query/auth errors in a top-level `errors` array (HTTP 200).
  if (result.errors && result.errors.length) {
    const message = result.errors.map((e) => e.message).join("; ");
    // Hasura signals a bad/expired JWT inside the errors array too.
    if (/jwt|unauthor|token/i.test(message)) {
      logout();
    }
    throw new Error(message || "GraphQL query failed.");
  }

  return result.data;
}

// Expand / collapse all profile cards at once. Toggles the `open` attribute on
// every <details class="card">, and disables each button when it has no effect
// (Expand all when every card is already open, Collapse all when all are closed).
function setupSectionControls() {
  const expandBtn = document.getElementById("expand-all");
  const collapseBtn = document.getElementById("collapse-all");
  if (!expandBtn || !collapseBtn) return;

  const cards = () => document.querySelectorAll("#profile .card");

  const refresh = () => {
    const all = [...cards()];
    const anyClosed = all.some((c) => !c.open);
    const anyOpen = all.some((c) => c.open);
    expandBtn.disabled = !anyClosed; // nothing left to expand
    collapseBtn.disabled = !anyOpen; // nothing left to collapse
  };

  const setAll = (open) => {
    for (const card of cards()) card.open = open;
    refresh();
  };

  expandBtn.addEventListener("click", () => setAll(true));
  collapseBtn.addEventListener("click", () => setAll(false));

  // Keep the buttons in sync when a card is toggled individually.
  for (const card of cards()) {
    card.addEventListener("toggle", refresh);
  }

  refresh();
}

/* ---------------- INIT ---------------- */

// Wire up the graph zoom modal once (adds document-level listeners).
setupGraphModal();
setupSectionControls();
setupToggles();
setupProjectsToggle();
setupPlayground();