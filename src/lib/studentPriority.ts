/**
 * Shared deterministic logic for classifying students (🔴🟡🟢)
 * and selecting the highest-priority one for the teacher to attend to.
 *
 * Used by both:
 *   - StudentsListSheet.tsx (check-in mode, list ordering)
 *   - ClassQuadro.tsx       (card "Chi ha bisogno di attenzione")
 *
 * Keeping this in one place guarantees the student shown on top of the
 * sheet is the same one promoted in the Quadro card — no incoherences.
 */

export type StudentCategory = "attenzione" | "occhio" | "norma";

export interface ClassifiedStudent {
  id: string;
  name: string;
  category: StudentCategory;
  meanScore: number | null;
  pendingCount: number;
  moodStreak: number;
  sessions7d: number;
  // Free-form passthrough for callers that need extra fields (lastActivity, etc.)
  [extra: string]: any;
}

export interface ClassifyInput {
  id: string;
  name: string;
  /** Average score across all assignments (0-100), null if unknown. */
  meanScore: number | null;
  /** Count of assigned items not yet completed by this student. */
  pendingCount: number;
  /** Consecutive recent negative emotional check-ins. */
  moodStreak: number;
  /** Focus sessions in the last 7 days. */
  sessions7d: number;
  /** Focus sessions in the previous 7 days (8..14d ago). */
  sessionsPrev7d: number;
  [extra: string]: any;
}

/**
 * Apply the deterministic classification rule.
 * Mirrors the rule used in ClassView for the check-in sheet.
 */
export function classifyStudent(s: ClassifyInput): StudentCategory {
  const { meanScore, pendingCount, moodStreak, sessions7d, sessionsPrev7d } = s;

  // 🔴 ATTENZIONE
  if (
    (meanScore != null && meanScore < 50 && pendingCount > 0) ||
    moodStreak >= 5 ||
    (sessions7d === 0 && moodStreak >= 2)
  ) {
    return "attenzione";
  }

  // 🟡 DA TENERE D'OCCHIO
  if (
    (meanScore != null && meanScore < 50) ||
    (moodStreak >= 3 && moodStreak <= 4) ||
    (sessionsPrev7d > 0 && sessions7d < sessionsPrev7d)
  ) {
    return "occhio";
  }

  return "norma";
}

/**
 * Order students by urgency. Returns a NEW array.
 *
 * Priority (highest first):
 *   1. 🔴 with mood_streak >= 5
 *   2. 🔴 with score < 50% AND pendingCount > 0
 *   3. other 🔴
 *   4. 🟡 by lowest score
 *   5. 🟢
 *
 * Tie-breaker at every level: ascending mean score
 * (lowest score first), then name A-Z.
 */
export function sortByPriority<T extends ClassifiedStudent>(students: T[]): T[] {
  const tier = (s: T): number => {
    if (s.category === "attenzione") {
      if (s.moodStreak >= 5) return 0;
      if ((s.meanScore ?? 100) < 50 && s.pendingCount > 0) return 1;
      return 2;
    }
    if (s.category === "occhio") return 3;
    return 4;
  };

  return [...students].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;

    // Tie-breaker: lowest score first (nulls last), then name
    const sa = a.meanScore ?? Number.POSITIVE_INFINITY;
    const sb = b.meanScore ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Return the single most urgent student, or null when nobody needs attention
 * (i.e., all green or empty).
 */
export function getPriorityStudent<T extends ClassifiedStudent>(students: T[]): T | null {
  const sorted = sortByPriority(students);
  const top = sorted[0];
  if (!top) return null;
  if (top.category === "norma") return null;
  return top;
}

/**
 * Count how many students are 🔴 + 🟡.
 */
export function countNeedingAttention(students: ClassifiedStudent[]): number {
  return students.filter((s) => s.category !== "norma").length;
}
