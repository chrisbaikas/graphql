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
}

// Ticket 5 — Section 1: basic user identification.
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