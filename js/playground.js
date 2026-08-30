/* ---------------- GRAPHIQL PLAYGROUND ---------------- */

// An in-app query playground: type a query, run it against the platform
// endpoint with the logged-in user's JWT, and read the JSON back.
//
// It deliberately does NOT reuse graphqlRequest(). That helper returns only
// `data` and throws on `errors[]`, which is right for the dashboard but wrong
// here: a playground must SHOW a malformed query's error — line, column and
// all — rather than collapse it into a thrown message. So this posts directly
// and renders whatever comes back, errors included.

import { DEFAULT_PLAYGROUND_QUERY, GRAPHQL_URL, TOKEN_KEY } from "./config.js";
import { isTokenExpired } from "./core/jwt.js";
import { endSession } from "./core/session.js";

export async function runPlaygroundQuery() {
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

  const jwt = localStorage.getItem(TOKEN_KEY);
  if (!jwt || isTokenExpired(jwt)) {
    endSession();
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
      endSession();
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
  } catch (err) {
    // Only a fetch rejection is a network problem; anything else here (a DOM
    // failure, a stringify error) would be misreported as one.
    const isNetwork = err instanceof TypeError;
    resultEl.textContent = isNetwork
      ? "Network error — could not reach the GraphQL server."
      : `Something went wrong: ${err.message}`;
    setStatus("Failed");
  } finally {
    if (runBtn) runBtn.disabled = false;
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
      queryEl.value = btn.dataset.query || "";
      queryEl.focus();
    });
  }
}

// Clear the playground's result pane — called on logout so one user's query
// output can't linger for the next.
export function resetPlayground() {
  const resultEl = document.getElementById("gql-result");
  const statusEl = document.getElementById("gql-status");
  const queryEl = document.getElementById("gql-query");
  const varsEl = document.getElementById("gql-variables");
  if (resultEl) resultEl.textContent = "Run a query to see the result.";
  if (statusEl) statusEl.textContent = "";
  // The editors too, not just the output: a query someone typed can name ids
  // or filters that belong to their session, not the next one's.
  if (queryEl) queryEl.value = DEFAULT_PLAYGROUND_QUERY;
  if (varsEl) varsEl.value = "";
}
