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
  loadUserSection();
  loadXpSection();
  loadGradesSection();
  loadRecentSection();
  loadStatsSection();
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

// Ticket 7 — Section 3: audit ratio (XP given vs received), matching the
// platform profile's "Done" (up) / "Received" (down) figures.
async function loadGradesSection() {
  const doneEl = document.getElementById("audit-done");
  const receivedEl = document.getElementById("audit-received");
  const ratioEl = document.getElementById("audit-ratio");

  try {
    // "With arguments" query: only up/down transactions are audit XP.
    const auditData = await graphqlRequest(
      `{ transaction(where: { type: { _in: ["up", "down"] } }) { type amount } }`
    );
    const transactions = auditData.transaction || [];
    let done = 0; // XP given to others (audits done)
    let received = 0; // XP received from others (audits on you)
    for (const t of transactions) {
      if (t.type === "up") done += t.amount || 0;
      else if (t.type === "down") received += t.amount || 0;
    }
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
        limit: 5
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

    if (!results.length) {
      listEl.innerHTML = "<li>No projects yet.</li>";
      return;
    }

    for (const r of results) {
      const name = (r.object && r.object.name) || "Unknown";
      const status = r.grade >= 1 ? "pass" : "fail";
      const li = document.createElement("li");
      li.textContent = `${name} — ${status}`;
      listEl.appendChild(li);
    }
  } catch (err) {
    if (listEl) listEl.innerHTML = "<li>—</li>";
    showError(`Could not load recent projects: ${err.message}`);
  }
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

    // ---- coordinate space ----
    const W = 480;
    const H = 260;
    const pad = { top: 16, right: 16, bottom: 28, left: 52 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    const yMax = points[points.length - 1].y; // cumulative, so last is largest
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax || 1;

    const sx = (x) => pad.left + ((x - xMin) / xSpan) * plotW;
    const sy = (y) => pad.top + plotH - (y / ySpan) * plotH;

    const svg = createSvg(W, H);
    svg.setAttribute("aria-label", "Cumulative XP over time");

    // ---- axes ----
    svg.appendChild(svgEl("line", {
      x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + plotH,
      stroke: "#475569", "stroke-width": 1
    }));
    svg.appendChild(svgEl("line", {
      x1: pad.left, y1: pad.top + plotH, x2: pad.left + plotW, y2: pad.top + plotH,
      stroke: "#475569", "stroke-width": 1
    }));

    // ---- Y axis labels (0 and max) ----
    const yLabel0 = svgEl("text", {
      x: pad.left - 6, y: pad.top + plotH, "text-anchor": "end",
      "dominant-baseline": "middle", fill: "#94a3b8", "font-size": 11
    });
    yLabel0.textContent = "0";
    svg.appendChild(yLabel0);

    const yLabelMax = svgEl("text", {
      x: pad.left - 6, y: pad.top, "text-anchor": "end",
      "dominant-baseline": "middle", fill: "#94a3b8", "font-size": 11
    });
    yLabelMax.textContent = formatXp(yMax);
    svg.appendChild(yLabelMax);

    // ---- X axis labels (first and last date) ----
    const fmtDate = (ms) => new Date(ms).toLocaleDateString();
    const xLabelStart = svgEl("text", {
      x: pad.left, y: pad.top + plotH + 16, "text-anchor": "start",
      fill: "#94a3b8", "font-size": 11
    });
    xLabelStart.textContent = fmtDate(xMin);
    svg.appendChild(xLabelStart);

    const xLabelEnd = svgEl("text", {
      x: pad.left + plotW, y: pad.top + plotH + 16, "text-anchor": "end",
      fill: "#94a3b8", "font-size": 11
    });
    xLabelEnd.textContent = fmtDate(xMax);
    svg.appendChild(xLabelEnd);

    // ---- the cumulative line ----
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
// stored token and any rendered profile data so nothing protected lingers.
function logout() {
  localStorage.removeItem("token");
  const profile = document.getElementById("profile");
  if (profile) profile.innerHTML = "";
  showLogin();
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