/* ---------------- ENTRY POINT ---------------- */
//
// Wiring only: register listeners, connect the session hook, then route.
// Everything here runs after all imports have been evaluated, so there is no
// ordering hazard between the setup calls and the module state they touch.

import { TOKEN_KEY } from "./config.js";
import { isTokenExpired } from "./core/jwt.js";
import { registerSessionEnd } from "./core/session.js";
import { login, logout } from "./core/auth.js";

import { setupGraphModal } from "./ui/modal.js";
import { setupSectionControls } from "./ui/sections.js";
import { setupToggles } from "./ui/collapsible.js";
import { setupProjectsToggle } from "./charts/projectsGraph.js";
import { setupPlayground } from "./playground.js";
import { showDashboard } from "./ui/views.js";

// core/graphql.js and playground.js end the session through this hook rather
// than importing auth.js directly, which would make an import cycle
// (graphql -> auth -> views -> sections -> graphql).
registerSessionEnd(logout);

const loginForm = document.getElementById("login-form");
if (loginForm) loginForm.addEventListener("submit", login);

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", () => logout());

setupGraphModal();
setupSectionControls();
setupToggles();
setupProjectsToggle();
setupPlayground();

// Route on load: a valid, unexpired token keeps the user on the dashboard;
// a missing or expired/invalid token sends them to login (auto-logout).
const storedToken = localStorage.getItem(TOKEN_KEY);
if (storedToken && !isTokenExpired(storedToken)) {
  showDashboard();
} else {
  logout(); // clears any stale/expired token and shows the login view
}
