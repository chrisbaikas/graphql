// Section 1: basic user identification.
// Rendered from the app's NORMAL query: `{ user { id login } }`.

import { fetchUser } from "../data/profile.js";
import { reportSectionError } from "../ui/errors.js";

export async function loadUserSection() {
  const loginEl = document.getElementById("user-login");
  const idEl = document.getElementById("user-id");

  try {
    const user = await fetchUser();
    if (loginEl) loginEl.textContent = user.login;
    if (idEl) idEl.textContent = user.id;
  } catch (err) {
    if (loginEl) loginEl.textContent = "—";
    if (idEl) idEl.textContent = "—";
    reportSectionError("Could not load user info", err);
  }
}
