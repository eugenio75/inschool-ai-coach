import coachHappy from "@/assets/coach-avatars/happy.png";
import coachThinking from "@/assets/coach-avatars/thinking.png";
import coachEncouraging from "@/assets/coach-avatars/encouraging.png";
import coachConcerned from "@/assets/coach-avatars/concerned.png";
import coachCelebrating from "@/assets/coach-avatars/celebrating.png";

export type CoachMood = "happy" | "thinking" | "encouraging" | "concerned" | "celebrating";

const moodMap: Record<CoachMood, string> = {
  happy: coachHappy,
  thinking: coachThinking,
  encouraging: coachEncouraging,
  concerned: coachConcerned,
  celebrating: coachCelebrating,
};

/** Default avatar for static contexts */
export const coachAvatarSrc = coachHappy;

/** Get avatar source by mood */
export function getCoachMoodSrc(mood: CoachMood): string {
  return moodMap[mood] || coachHappy;
}

/**
 * Determine coach mood from context data.
 * Used in CoachPresence to automatically pick the right expression.
 */
export function detectCoachMood(ctx: {
  urgentCount?: number;
  streak?: number;
  pendingHomework?: any[];
  recentErrors?: any[];
  recentEmotions?: any[];
  messageType?: "celebration" | "concern" | "encouragement" | "question" | "neutral";
}): CoachMood {
  // Explicit message type overrides (used during exercises/sessions)
  if (ctx.messageType === "celebration") return "celebrating";
  if (ctx.messageType === "concern") return "concerned";
  if (ctx.messageType === "encouragement") return "encouraging";
  if (ctx.messageType === "question") return "thinking";

  // Default: always happy on dashboard/home
  // Only celebrating for high streaks
  if ((ctx.streak || 0) >= 5) return "celebrating";

  return "happy";
}
