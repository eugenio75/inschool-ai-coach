// ═══════════════════════════════════════════════════════════════
// formatName — Normalizza nomi propri (es. "MARIACLARA" → "Mariaclara")
// Applica capitalizzazione "first upper, rest lower" parola per parola.
// Funziona sia per "MARIA CLARA" (→ "Maria Clara") che per nomi composti
// con apostrofo o trattino ("D'ANGELO" → "D'Angelo", "JEAN-LUC" → "Jean-Luc").
// ═══════════════════════════════════════════════════════════════

export function formatName(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  // Split on whitespace, hyphen, apostrophe — preserve separators
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'’])([\p{L}])/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

export function formatFullName(first?: string | null, last?: string | null): string {
  const f = formatName(first);
  const l = formatName(last);
  return [f, l].filter(Boolean).join(" ");
}
