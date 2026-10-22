/* ---------------- AUTH ---------------- */

import { SIGNIN_URL } from "../config.js";
import { fetchWithTimeout, readResponse, TimeoutError } from "./http.js";
import { clearToken, setToken } from "./storage.js";
import { isTokenExpired } from "./jwt.js";
import { currentSession, isCurrentSession, sessionSignal } from "./session.js";
import { showError } from "../ui/errors.js";
import { resetProfile, showDashboard, showLogin } from "../ui/views.js";

let activeLogin = null;

export async function login(event) {
  if (event) event.preventDefault();
  if (activeLogin) return;

  // Works for both "username:password" and "email:password" — the platform
  // accepts either identifier in the Basic auth header.
  const passwordEl = document.getElementById("password");
  const identifier = document.getElementById("username").value.trim();
  const password = passwordEl ? passwordEl.value : "";

  const errorText = document.getElementById("error");
  if (errorText) errorText.textContent = "";

  if (!identifier || !password) {
    showError("Please enter your username/email and password.");
    return;
  }

  const submitBtn = document.getElementById("login-btn");
  const session = currentSession();
  const attempt = {};
  activeLogin = attempt;
  if (submitBtn) submitBtn.disabled = true;

  try {
    // Credential validation belongs inside the error/button cleanup path.
    const credentials = basicAuth(identifier, password);

    let response;
    try {
      response = await fetchWithTimeout(SIGNIN_URL, {
        method: "POST",
        signal: sessionSignal(),
        headers: {
          "Authorization": `Basic ${credentials}`
        }
      });
    } catch (err) {
      if (err instanceof TimeoutError) throw err;
      throw new Error("Network error — could not reach the server.");
    }

    // Separate rejected credentials from platform outages.
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid credentials. Please try again.");
    }
    if (!response.ok) {
      throw new Error(
        `The sign-in server returned an error (${response.status}). ` +
        "Please try again in a moment."
      );
    }

    const jwt = cleanToken(await readResponse(response, "text"));
    if (!isCurrentSession(session)) return;
    if (!jwt) {
      throw new Error("Login failed: no token returned by the server.");
    }
    if (isTokenExpired(jwt)) {
      throw new Error("Login failed: the server returned an invalid or expired token.");
    }

    if (!setToken(jwt)) {
      throw new Error(
        "Could not start a session — this browser is blocking site storage."
      );
    }
    // Clear the password before showing the dashboard.
    if (passwordEl) passwordEl.value = "";
    showDashboard();
  } catch (err) {
    if (!isCurrentSession(session)) return;
    showError(err.message);
  } finally {
    if (activeLogin === attempt) {
      activeLogin = null;
      if (submitBtn) submitBtn.disabled = false;
    }
  }
}

// All session-ending paths clear credentials, caches and rendered data here.
export function logout() {
  activeLogin = null;
  const submitBtn = document.getElementById("login-btn");
  if (submitBtn) submitBtn.disabled = false;
  clearToken();
  // Keep the identifier for convenience, but never retain the password.
  const passwordEl = document.getElementById("password");
  if (passwordEl) passwordEl.value = "";
  resetProfile();
  showLogin();
}

// Encode UTF-8 bytes before base64 so Greek/emoji credentials work too.
export function basicAuth(identifier, password) {
  if (identifier.includes(":")) throw new Error("Username/email cannot contain a colon.");
  const bytes = new TextEncoder().encode(`${identifier}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// The signin endpoint returns the JWT as a quoted string (e.g. "eyJ...").
// Strip surrounding quotes/whitespace so the Bearer header is valid later.
export function cleanToken(raw) {
  return raw.trim().replace(/^"+|"+$/g, "").trim();
}
