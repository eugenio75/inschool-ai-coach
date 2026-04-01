/**
 * Returns the correct Italian teacher title based on gender.
 * "Prof." for male, "Prof.ssa" for female, "Prof." as default fallback.
 */
export function getTeacherTitle(gender: string | null | undefined): string {
  if (gender === "f") return "Prof.ssa";
  return "Prof.";
}

/**
 * Formats teacher display name with title.
 * Uses last_name if available, otherwise falls back to first name.
 */
export function formatTeacherDisplay(
  name: string,
  lastName?: string | null,
  gender?: string | null
): string {
  const title = getTeacherTitle(gender);
  const displayName = lastName || name;
  return `${title} ${displayName}`;
}
