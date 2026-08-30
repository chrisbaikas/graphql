/* ---------------- AUTH ---------------- */

import { SIGNIN_URL, TOKEN_KEY } from "../config.js";
import { showError } from "../ui/errors.js";
import { resetProfile, showDashboard, showLogin } from "../ui/views.js";

export async function login(event) {
  if (event) event.preventDefault();

  // Works for both "username:password" and "email:password" — the platform
  // accepts either identifier in the Basic auth header.
  const identifier = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const errorText = document.getElementById("error");
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
    } catch {
      throw new Error("Network error — could not reach the server.");
    }

    // Only 401/403 means the credentials were actually rejected. A 500 or 502
    // is the platform failing, and telling the user their password is wrong
    // sends them off retrying credentials that were fine.
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid credentials. Please try again.");
    }
    if (!response.ok) {
      throw new Error(
        `The sign-in server returned an error (${response.status}). ` +
        "Please try again in a moment."
      );
    }

    const jwt = cleanToken(await response.text());
    if (!jwt) {
      throw new Error("Login failed: no token returned by the server.");
    }

    localStorage.setItem(TOKEN_KEY, jwt);
    showDashboard();
  } catch (err) {
    showError(err.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Single source of truth for ending a session. Used by the logout button and
// triggered automatically when a token is missing/expired/rejected. Clears the
// stored token and resets rendered values so no protected data lingers — but
// keeps the card structure intact so a later re-login can repopulate it.
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  resetProfile();
  showLogin();
}

// The signin endpoint returns the JWT as a quoted string (e.g. "eyJ...").
// Strip surrounding quotes/whitespace so the Bearer header is valid later.
export function cleanToken(raw) {
  return raw.trim().replace(/^"+|"+$/g, "").trim();
}
