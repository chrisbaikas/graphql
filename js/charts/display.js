/* Responsive chart mounting and zoom semantics; placeholders have no action. */
import { CHART } from "./svg.js";
import { truncate } from "../ui/format.js";

const observers = new WeakMap();

function stopObserving(box) {
  observers.get(box)?.disconnect();
  observers.delete(box);
}

export function showGraphPlaceholder(box, message) {
  stopObserving(box);
  for (const attribute of ["role", "tabindex", "aria-label", "aria-description"]) {
    box.removeAttribute(attribute);
  }
  const placeholder = document.createElement("p");
  placeholder.className = "graph-placeholder";
  placeholder.textContent = message;
  box.replaceChildren(placeholder);
}

export function showGraph(box, draw) {
  stopObserving(box);
  let previousWidth;

  function render() {
    const style = getComputedStyle(box);
    const available = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // Hidden <details> have no width. Paint once, then resize when opened.
    const width = Math.min(CHART.W, available > 0 ? available : CHART.W);
    if (width === previousWidth) return;
    previousWidth = width;
    const svg = draw(width);
    box.replaceChildren(svg);

    // Keep names readable by shortening text, rather than squeezing its glyphs.
    // Full project names remain available in the bars' native tooltips.
    for (const text of svg.querySelectorAll("text[data-max-width]")) {
      const maxWidth = Number(text.getAttribute("data-max-width"));
      if (text.hasAttribute("data-project-name")) {
        const fullText = text.textContent;
        let length = Array.from(fullText).length;
        while (text.getComputedTextLength() > maxWidth && length > 1) {
          text.textContent = truncate(fullText, --length);
        }
      } else if (text.getComputedTextLength() > maxWidth) {
        text.setAttribute("textLength", maxWidth);
        text.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    }
    box.setAttribute("role", "button");
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-label", `${svg.getAttribute("aria-label")} — activate to enlarge`);
    box.setAttribute("aria-description", svg.getAttribute("aria-description"));
  }

  render();
  const observer = new ResizeObserver(() => {
    if (observers.get(box) === observer) render();
  });
  observers.set(box, observer);
  observer.observe(box);
}
