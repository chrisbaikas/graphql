// Section 1: basic user identification.
// Rendered from the app's NORMAL query: `{ user { id login } }`.

import { fetchUser } from "../data/profile.js";
import { reportSectionError } from "../ui/errors.js";
import { currentSession, isCurrentSession } from "../core/session.js";

export async function loadUserSection() {
  const loginEl = document.getElementById("user-login");
  const idEl = document.getElementById("user-id");

  // Captured before the first await: a response arriving after a logout (or
  // after a newer load started) belongs to a session that no longer exists.
  const session = currentSession();

  try {
    const user = await fetchUser();
    if (!isCurrentSession(session)) return;
    if (loginEl) loginEl.textContent = user.login;
    if (idEl) idEl.textContent = user.id;
  } catch (err) {
    if (!isCurrentSession(session)) return;
    if (loginEl) loginEl.textContent = "—";
    if (idEl) idEl.textContent = "—";
    reportSectionError("Could not load user info", err);
  }
}
