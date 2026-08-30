/* ---------------- FORMATTING HELPERS ---------------- */

// The platform reports XP in bytes. Render it human-readably (kB / MB) so the
// number matches how the platform profile presents it.
export function formatXp(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} kB`;
  return `${bytes} B`;
}

// Format a timestamp (ms) as DD/MM/YYYY — fixed order, not locale-dependent
// (toLocaleDateString would show MM/DD/YYYY in a US-locale browser).
export function formatDate(ms) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// "skill_go" -> "Go", "skill_web-dev" -> "Web dev". Turns the raw transaction
// type into something readable in the UI.
export function formatSkillName(type) {
  const raw = String(type).replace(/^skill_/, "").replace(/[-_]+/g, " ").trim();
  if (!raw) return type;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// SVG has no text-overflow, so long project names are shortened by hand.
export function truncate(text, max) {
  const str = String(text);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
