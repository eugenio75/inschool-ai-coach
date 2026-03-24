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
  // Explicit message type overrides
  if (ctx.messageType === "celebration") return "celebrating";
  if (ctx.messageType === "concern") return "concerned";
  if (ctx.messageType === "encouragement") return "encouraging";
  if (ctx.messageType === "question") return "thinking";

  // Context-based detection
  if ((ctx.streak || 0) >= 5) return "celebrating";
  if ((ctx.urgentCount || 0) > 2) return "concerned";
  if ((ctx.recentErrors || []).length > 0) return "encouraging";
  if ((ctx.pendingHomework || []).length === 0 && (ctx.streak || 0) > 0) return "happy";
  if ((ctx.pendingHomework || []).length > 0) return "thinking";

  return "happy";
}
