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

/**
 * Detect mood from a coach message text (for chat bubbles).
 */
export function detectMoodFromText(text: string): CoachMood {
  const lower = text.toLowerCase();

  // Celebrating patterns
  if (/bravo|bravissim[ao]|ottimo|perfetto|eccellente|fantastico|complimenti|ben fatto|hai completato|🎉|✅|💪|🌟/i.test(lower))
    return "celebrating";

  // Concerned patterns
  if (/difficolt[àa]|errore|sbagliato|attenzione|non è corrett|riprova|non proprio|purtroppo|hmm/i.test(lower))
    return "concerned";

  // Encouraging patterns
  if (/forza|dai che|ci sei quasi|continua|non mollare|stai andando|bene così|quasi giusto|buon lavoro|ci siamo/i.test(lower))
    return "encouraging";

  // Thinking/question patterns
  if (/\?|pensa|rifletti|secondo te|prova a|cosa ne pensi|come faresti|perché|qual è/i.test(lower))
    return "thinking";

  return "happy";
}
