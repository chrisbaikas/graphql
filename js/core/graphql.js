/* Dashboard transport: reject partial data rather than display partial totals. */
import { GRAPHQL_URL } from "../config.js";
import { fetchWithTimeout, readResponse, TimeoutError } from "./http.js";
import { isTokenExpired } from "./jwt.js";
import { getToken } from "./storage.js";
import { currentSession, isCurrentSession, sessionSignal, endSession, SilentError } from "./session.js";
import { isGraphqlEnvelope, graphqlErrorMessage, hasSessionError } from "./graphqlResponse.js";

export async function graphqlRequest(query, variables = {}) {
  const jwt = getToken();
  const session = currentSession();
  const ensureCurrent = () => {
    if (!isCurrentSession(session) || getToken() !== jwt) throw new SilentError("");
  };
  const rejectSession = (message) => {
    endSession(message);
    throw new SilentError("");
  };
  if (!jwt || isTokenExpired(jwt)) {
    rejectSession(jwt ? "Your session has expired. Please log in again." : "");
  }

  let response;
  try {
    response = await fetchWithTimeout(GRAPHQL_URL, {
      method: "POST", signal: sessionSignal(),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
      body: JSON.stringify({ query, variables })
    });
  } catch (err) {
    ensureCurrent();
    if (err instanceof TimeoutError) throw err;
    if (err?.name === "AbortError") throw new Error("The GraphQL request was cancelled.");
    throw new Error("Network error — could not reach the GraphQL server.");
  }
  ensureCurrent();
  if (response.status === 401) rejectSession("Your session is no longer valid. Please log in again.");

  let result;
  try {
    result = await readResponse(response);
  } catch (err) {
    ensureCurrent();
    if (err instanceof TimeoutError) throw err;
    if (err?.name === "AbortError") throw new Error("The GraphQL request was cancelled.");
    // Preserve HTTP status even if an error page is HTML or empty.
    if (response.ok) throw new Error("Received an invalid JSON response from the GraphQL server.");
  }
  ensureCurrent();
  if (hasSessionError(result)) rejectSession("Your session is no longer valid. Please log in again.");

  const detail = graphqlErrorMessage(result);
  if (!response.ok) {
    const reason = response.status === 403 ? "Access denied by the GraphQL server" : "The GraphQL server returned an error";
    throw new Error(`${reason} (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  if (!isGraphqlEnvelope(result)) throw new Error("Received an invalid response from the GraphQL server.");
  if (result.errors?.length) throw new Error(detail || "GraphQL query failed.");
  return result.data;
}
