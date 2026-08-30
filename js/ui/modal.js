/* ---------------- GRAPH ZOOM (modal) ---------------- */

// Click any graph box to open an enlarged copy in a modal; close with the X,
// a backdrop click, or Escape. The SVG is cloned (not moved) so the dashboard
// graph stays in place.
export function setupGraphModal() {
  const modal = document.getElementById("graph-modal");
  const body = document.getElementById("modal-body");
  const closeBtn = document.getElementById("modal-close");
  if (!modal || !body || !closeBtn) return;

  // Remembered so focus can return where it came from when the modal closes —
  // otherwise a keyboard user is dumped back at the top of the document.
  let lastTrigger = null;

  function openModal(svg, trigger) {
    body.innerHTML = "";
    body.appendChild(svg.cloneNode(true));
    modal.hidden = false;
    lastTrigger = trigger || null;
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    body.innerHTML = "";
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
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
    if (box) openModal(box.querySelector("svg"), box);
  });

  // One keydown handler for both directions, so the open/close branches can't
  // drift apart or depend on listener registration order.
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) {
      // Closed: the graph boxes are focusable (tabindex in the markup), so
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
