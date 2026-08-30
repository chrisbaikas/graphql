/* ---------------- GRAPHQL SERVICE ---------------- */

import { GRAPHQL_URL } from "../config.js";
import { fetchWithTimeout, TimeoutError } from "./http.js";
import { isTokenExpired } from "./jwt.js";
import { getToken } from "./storage.js";
import { endSession, SilentError } from "./session.js";

// The single entry point for every GraphQL call in the app. Sends the query
// (and optional variables) to the endpoint with Bearer auth and returns the
// `data` object. On any auth failure it logs the user out; on any other failure
// it throws an Error with a readable message (callers handle the rejection).
export async function graphqlRequest(query, variables = {}) {
  const jwt = getToken();

  // No usable token — end the session before we even hit the network.
  // loadProfile() fires several loaders at once, so on an expired token every
  // one of them lands here. Only the first should speak: the rest would each
  // overwrite the login view's single #error line with the same message.
  if (!jwt || isTokenExpired(jwt)) {
    const alreadyLoggedOut = !getToken();
    endSession();
    throw new SilentError(
      alreadyLoggedOut ? "" : "Your session has expired. Please log in again."
    );
  }

  let response;
  try {
    response = await fetchWithTimeout(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (err) {
    // As in login(): a timeout keeps its own message rather than being
    // reported as an unreachable server.
    if (err instanceof TimeoutError) throw err;
    throw new Error("Network error — could not reach the GraphQL server.");
  }

  // The server rejected the token (expired/revoked) — force a logout. As above,
  // only the first concurrent caller reports it.
  if (response.status === 401 || response.status === 403) {
    const alreadyLoggedOut = !getToken();
    endSession();
    throw new SilentError(
      alreadyLoggedOut ? "" : "Your session is no longer valid. Please log in again."
    );
  }

  let result;
  let parsed = true;
  try {
    result = await response.json();
  } catch {
    parsed = false;
  }

  // Anything other than 401/403 that still failed — a 500, a 502, a 404 — is
  // reported with its status. Reading such a body as a GraphQL envelope is what
  // turns a server outage into an unrelated "Cannot read properties of
  // undefined" further down the call chain.
  if (!response.ok) {
    const detail = parsed && result && typeof result.message === "string"
      ? `: ${result.message}`
      : "";
    throw new Error(
      `The GraphQL server returned an error (${response.status})${detail}.`
    );
  }

  if (!parsed) {
    throw new Error("Received an invalid response from the GraphQL server.");
  }

  // GraphQL reports query/auth errors in a top-level `errors` array (HTTP 200).
  if (result.errors && result.errors.length) {
    const message = result.errors.map((e) => e.message).join("; ");
    // Hasura signals a bad/expired JWT inside the errors array too.
    if (/jwt|unauthor|token/i.test(message)) {
      endSession();
    }
    throw new Error(message || "GraphQL query failed.");
  }

  return result.data;
}
