/* ---------------- ENTRY POINT ---------------- */
//
// Wiring only: register listeners, connect the session hook, then route.
// Everything here runs after all imports have been evaluated, so there is no
// ordering hazard between the setup calls and the module state they touch.

import { isTokenExpired } from "./core/jwt.js";
import { clearLegacyToken, getToken } from "./core/storage.js";
import { registerSessionEnd } from "./core/session.js";
import { login, logout } from "./core/auth.js";

import { setupGraphModal } from "./ui/modal.js";
import { setupSectionControls } from "./ui/sections.js";
import { setupToggles } from "./ui/collapsible.js";
import { setupProjectsToggle } from "./charts/projectsGraph.js";
import { setupPlayground } from "./playground.js";
import { showDashboard } from "./ui/views.js";
import { showError } from "./ui/errors.js";

// core/graphql.js and playground.js end the session through this hook rather
// than importing auth.js directly, which would make an import cycle
// (graphql -> auth -> views -> sections -> graphql).
registerSessionEnd((message) => {
  logout();
  showError(message);
});

const loginForm = document.getElementById("login-form");
if (loginForm) loginForm.addEventListener("submit", login);
const loginBtn = document.getElementById("login-btn");
if (loginBtn) loginBtn.disabled = false;

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => logout());

setupGraphModal();
setupSectionControls();
setupToggles();
setupProjectsToggle();
setupPlayground();

clearLegacyToken();

// Route on load: a valid, unexpired token keeps the user on the dashboard;
// a missing or expired/invalid token sends them to login (auto-logout).
const storedToken = getToken();
if (storedToken && !isTokenExpired(storedToken)) {
  showDashboard();
} else {
  logout(); // clears any stale/expired token and shows the login view
  if (storedToken) showError("Your saved session is invalid or expired. Please log in again.");
}
