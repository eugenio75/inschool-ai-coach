/**
 * Normalize a class string like "3A", "3a", "3° A", "3a A" → "3ª A"
 * Returns the normalized string, or the original if it can't be parsed.
 */
export function normalizeClass(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  // Match patterns like "3A", "3a", "3°A", "3° A", "3ª A", "3a A"
  const match = trimmed.match(/^(\d+)\s*[°ªa]?\s*([A-Za-z])?$/i);
  if (!match) return trimmed;
  const num = match[1];
  const letter = match[2] ? match[2].toUpperCase() : "";
  return letter ? `${num}ª ${letter}` : `${num}ª`;
}

/**
 * Auto-format class input as user types.
 * Allows partial input while steering towards normalized format.
 */
export function formatClassInput(value: string): string {
  // Allow up to ~6 chars for flexibility
  const cleaned = value.slice(0, 6);
  return cleaned;
}
