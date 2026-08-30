/* ---------------- EXPAND / COLLAPSE ALL CARDS ---------------- */

// Expand / collapse all profile cards at once. Toggles the `open` attribute on
// every <details class="card">, and disables each button when it has no effect
// (Expand all when every card is already open, Collapse all when all are closed).
export function setupSectionControls() {
  const expandBtn = document.getElementById("expand-all");
  const collapseBtn = document.getElementById("collapse-all");
  if (!expandBtn || !collapseBtn) return;

  // The GraphiQL playground is a card too, but it is a tool rather than profile
  // content and is deliberately collapsed by default — leave it out so
  // "Expand all" doesn't unfold it along with the profile sections.
  const cards = () =>
    document.querySelectorAll("#profile .card:not(#graphiql-section)");

  const refresh = () => {
    const all = [...cards()];
    const anyClosed = all.some((c) => !c.open);
    const anyOpen = all.some((c) => c.open);
    expandBtn.disabled = !anyClosed; // nothing left to expand
    collapseBtn.disabled = !anyOpen; // nothing left to collapse
  };

  const setAll = (open) => {
    for (const card of cards()) card.open = open;
    refresh();
  };

  expandBtn.addEventListener("click", () => setAll(true));
  collapseBtn.addEventListener("click", () => setAll(false));

  // Keep the buttons in sync when a card is toggled individually.
  for (const card of cards()) {
    card.addEventListener("toggle", refresh);
  }

  refresh();
}
