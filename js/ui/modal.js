/* ---------------- GRAPH ZOOM (modal) ---------------- */

// Click any graph box to open an enlarged copy in a modal; close with the X,
// a backdrop click, or Escape. The SVG is cloned (not moved) so the dashboard
// graph stays in place.
// Return keyboard focus to the graph that opened the modal when closing it.
let lastTrigger = null;

export function closeGraphModal(restoreFocus = true) {
  const modal = document.getElementById("graph-modal");
  const body = document.getElementById("modal-body");
  if (modal) modal.hidden = true;
  const app = document.getElementById("app");
  if (app) app.inert = false;
  document.body.classList.remove("modal-open");
  if (body) body.innerHTML = "";
  if (restoreFocus && lastTrigger) lastTrigger.focus();
  lastTrigger = null;
}

export function setupGraphModal() {
  const modal = document.getElementById("graph-modal");
  const body = document.getElementById("modal-body");
  const closeBtn = document.getElementById("modal-close");
  if (!modal || !body || !closeBtn) return;

  function openModal(svg, trigger) {
    body.innerHTML = "";
    body.appendChild(svg.cloneNode(true));
    modal.hidden = false;
    const app = document.getElementById("app");
    if (app) app.inert = true;
    document.body.classList.add("modal-open");
    lastTrigger = trigger || null;
    closeBtn.focus();
  }

  function closeModal() {
    closeGraphModal();
  }

  // The .graph-box an event came from, but only if it currently holds an SVG.
  // `closest` lives on Element, so a non-element target (rare, but possible)
  // is filtered out first.
  function graphBoxFor(target) {
    if (!target || typeof target.closest !== "function") return null;
    const box = target.closest(".graph-box");
    if (!box || !box.querySelector("svg")) return null;
    return box;
  }

  // Event-delegate: any click inside a .graph-box that contains an <svg> opens
  // it. The graphs' Show more buttons sit outside the box, so they never reach
  // this handler.
  document.addEventListener("click", (e) => {
    const box = graphBoxFor(e.target);
    if (box && modal.hidden) openModal(box.querySelector("svg"), box);
  });

  // One keydown handler for both directions, so the open/close branches can't
  // drift apart or depend on listener registration order.
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) {
      // Loaded graph boxes are focusable, so
      // Enter/Space must open them — a click handler alone would leave the
      // zoom mouse-only.
      if (e.key !== "Enter" && e.key !== " ") return;
      const box = graphBoxFor(e.target);
      if (!box) return;
      e.preventDefault();
      openModal(box.querySelector("svg"), box);
      return;
    }

    // Open:
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    // Keep Tab inside the dialog. Close is the only focusable control in there,
    // so the trap is simply: always come back to it.
    if (e.key === "Tab") {
      e.preventDefault();
      closeBtn.focus();
    }
  });

  closeBtn.addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
}
