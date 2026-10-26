/* ---------------- GRAPHIQL PLAYGROUND ---------------- */

// An in-app query playground: type a query, run it against the platform
// endpoint with the logged-in user's JWT, and read the JSON back.
//
// It deliberately does NOT reuse graphqlRequest(). That helper returns only
// `data` and throws on `errors[]`, which is right for the dashboard but wrong
// here: a playground must SHOW a malformed query's error — line, column and
// all — rather than collapse it into a thrown message. So this posts directly
// and renders whatever comes back, errors included.

import { GRAPHQL_URL } from "./config.js";
import { fetchWithTimeout, readResponse, TimeoutError } from "./core/http.js";
import { isTokenExpired } from "./core/jwt.js";
import { getToken } from "./core/storage.js";
import { currentSession, endSession, isCurrentSession, sessionSignal } from "./core/session.js";

import { isGraphqlEnvelope, hasSessionError } from "./core/graphqlResponse.js";
import * as QUERIES from "./data/queries.js";

let activeRun = null;

export function parseVariables(raw) {
  const variables = raw.trim() ? JSON.parse(raw) : {};
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    throw new Error("Variables must be a JSON object.");
  }
  return variables;
}

export async function runPlaygroundQuery() {
  const queryEl = document.getElementById("gql-query");
  const varsEl = document.getElementById("gql-variables");
  const resultEl = document.getElementById("gql-result");
  const runBtn = document.getElementById("gql-run");
  const statusEl = document.getElementById("gql-status");
  if (!queryEl || !resultEl) return;
  if (activeRun) return;

  const query = queryEl.value.trim();
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  if (!query) {
    resultEl.textContent = "Enter a query first.";
    setStatus("");
    return;
  }

  // Variables are parsed here so a JSON typo is reported as such, rather than
  // reaching the server as a confusing GraphQL error.
  let variables;
  try {
    variables = parseVariables(varsEl?.value || "");
  } catch (err) {
    resultEl.textContent = `Invalid variables:\n${err.message}`;
    setStatus("Invalid variables");
    return;
  }

  const jwt = getToken();
  if (!jwt || isTokenExpired(jwt)) {
    endSession("Your session has expired. Please log in again.");
    return;
  }

  const run = {};
  activeRun = run;
  if (runBtn) runBtn.disabled = true;
  setStatus("Running…");
  const startedAt = Date.now();

  // Captured before the request: if the user logs out (or logs in as someone
  // else) while it is in flight, the answer belongs to a session that is gone
  // and must not be rendered into the next user's playground.
  const session = currentSession();
  const isActive = () => activeRun === run && isCurrentSession(session) && getToken() === jwt;

  try {
    const response = await fetchWithTimeout(GRAPHQL_URL, {
      method: "POST", signal: sessionSignal(),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (!isActive()) return;

    // A rejected token ends the session here as it would anywhere else.
    if (response.status === 401) {
      endSession("Your session is no longer valid. Please log in again.");
      return;
    }

    let result;
    try {
      result = await readResponse(response);
    } catch (err) {
      if (!isActive()) return;
      if (err instanceof TimeoutError || err?.name === "AbortError") throw err;
      resultEl.textContent = "The server returned a non-JSON response.";
      setStatus(response.ok ? "Failed" : `HTTP ${response.status} · Failed`);
      return;
    }

    if (!isActive()) return;

    if (hasSessionError(result)) {
      endSession("Your session is no longer valid. Please log in again.");
      return;
    }
    if (response.ok && !isGraphqlEnvelope(result)) {
      resultEl.textContent = "The server returned an invalid GraphQL response.";
      setStatus("Failed");
      return;
    }

    // Render the whole envelope — `errors` and `data` alike — so a failed query
    // is as informative as a successful one.
    resultEl.textContent = JSON.stringify(result, null, 2);

    const ms = Date.now() - startedAt;
    if (!response.ok) {
      setStatus(`HTTP ${response.status} · Failed · ${ms} ms`);
    } else if (result.errors?.length) {
      const count = result.errors.length;
      setStatus(`${count} error${count === 1 ? "" : "s"} · ${ms} ms`);
    } else {
      setStatus(`OK · ${ms} ms`);
    }
  } catch (err) {
    if (!isActive()) return;
    // A timeout is its own outcome — the query may simply be an expensive one,
    // which is worth saying rather than blaming the network.
    if (err instanceof TimeoutError) {
      resultEl.textContent =
        `${err.message}\nThe query may be too large — try narrowing it with a limit.`;
      setStatus("Timed out");
      return;
    }
    // Only a fetch rejection is a network problem; anything else here (a DOM
    // failure, a stringify error) would be misreported as one.
    if (err?.name === "AbortError") {
      resultEl.textContent = "The query was cancelled.";
      setStatus("Cancelled");
      return;
    }
    const isNetwork = err instanceof TypeError;
    resultEl.textContent = isNetwork
      ? "Network error — could not reach the GraphQL server."
      : `Something went wrong: ${err.message}`;
    setStatus("Failed");
  } finally {
    // Reset handles session changes; an old run must not re-enable the button
    // while a newer session's query is still running.
    if (activeRun === run) {
      activeRun = null;
      if (runBtn) runBtn.disabled = false;
    }
  }
}

// Wire the playground once on load: the Run button, Ctrl/Cmd+Enter inside the
// editor, and the example-query buttons.
export function setupPlayground() {
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
      queryEl.value = QUERIES[btn.dataset.query] || QUERIES.USER;
      const variablesEl = document.getElementById("gql-variables");
      if (variablesEl) variablesEl.value = "";
      queryEl.focus();
    });
  }
}

// Clear the playground's result pane — called on logout so one user's query
// output can't linger for the next.
export function resetPlayground() {
  activeRun = null;
  const runBtn = document.getElementById("gql-run");
  if (runBtn) runBtn.disabled = false;
  const resultEl = document.getElementById("gql-result");
  const statusEl = document.getElementById("gql-status");
  const queryEl = document.getElementById("gql-query");
  const varsEl = document.getElementById("gql-variables");
  if (resultEl) resultEl.textContent = "Run a query to see the result.";
  if (statusEl) statusEl.textContent = "";
  // The editors too, not just the output: a query someone typed can name ids
  // or filters that belong to their session, not the next one's.
  if (queryEl) queryEl.value = QUERIES.USER;
  if (varsEl) varsEl.value = "";
}
