/* ---------------- AUTH ---------------- */

import { SIGNIN_URL, TOKEN_KEY } from "../config.js";
import { showError } from "../ui/errors.js";
import { resetProfile, showDashboard, showLogin } from "../ui/views.js";

export async function login(event) {
  if (event) event.preventDefault();

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
  if (submitBtn) submitBtn.disabled = true;

  try {
    // Inside the try: basicAuth() can throw on an unencodable password, and a
    // thrown encoding error must reach showError() like any other failure
    // rather than escaping as an uncaught exception with the button stuck.
    const credentials = basicAuth(identifier, password);

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
    // The password must not survive the login. Without this it sits in the
    // input's value for the whole session and is still there — readable from
    // the DOM — when logout brings the same form back into view.
    if (passwordEl) passwordEl.value = "";
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
  // Belt and braces: clear the field on the way out too, so a failed login
  // attempt's password doesn't linger in the form either. The username is
  // deliberately left alone — it isn't a secret, and keeping it is a courtesy.
  const passwordEl = document.getElementById("password");
  if (passwordEl) passwordEl.value = "";
  resetProfile();
  showLogin();
}

// Build the Basic auth credential. btoa() only accepts Latin-1, so a password
// with any character outside that range (an accent, a Greek letter, an emoji)
// throws an InvalidCharacterError. The bytes are UTF-8 encoded first and then
// base64'd byte by byte, which is what the endpoint expects for non-ASCII input
// and is identical to plain btoa() for pure-ASCII credentials.
export function basicAuth(identifier, password) {
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
