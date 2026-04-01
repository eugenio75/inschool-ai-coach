import coachHappy from "@/assets/coach-avatars/happy.png";
import coachThinking from "@/assets/coach-avatars/thinking.png";
import coachEncouraging from "@/assets/coach-avatars/encouraging.png";
import coachConcerned from "@/assets/coach-avatars/concerned.png";
import coachCelebrating from "@/assets/coach-avatars/celebrating.png";
import coachFlame from "@/assets/coach-flame.svg";
import kidBoy1 from "@/assets/avatars/kid-boy-1.png";
import kidGirl1 from "@/assets/avatars/kid-girl-1.png";
import kidBoy2 from "@/assets/avatars/kid-boy-2.png";
import kidGirl2 from "@/assets/avatars/kid-girl-2.png";
import adultMale1 from "@/assets/avatars/adult-male-1.png";
import adultFemale1 from "@/assets/avatars/adult-female-1.png";
import adultMale2 from "@/assets/avatars/adult-male-2.png";
import adultFemale2 from "@/assets/avatars/adult-female-2.png";

export type CoachMood = "happy" | "thinking" | "encouraging" | "concerned" | "celebrating";

const moodMap: Record<CoachMood, string> = {
  happy: coachHappy,
  thinking: coachThinking,
  encouraging: coachEncouraging,
  concerned: coachConcerned,
  celebrating: coachCelebrating,
};

const selectedAvatarMap: Record<string, string> = {
  "kid-boy-1": kidBoy1,
  "kid-girl-1": kidGirl1,
  "kid-boy-2": kidBoy2,
  "kid-girl-2": kidGirl2,
  "adult-male-1": adultMale1,
  "adult-female-1": adultFemale1,
  "adult-male-2": adultMale2,
  "adult-female-2": adultFemale2,
};

/** Default fallback when no onboarding avatar is available */
export const coachAvatarSrc = coachFlame;

/** Get avatar source by mood */
export function getCoachMoodSrc(mood: CoachMood): string {
  return moodMap[mood] || coachHappy;
}

/** Resolve the student-selected onboarding avatar to an actual image source. */
export function getStudentAvatarSrc(avatarValue?: string | null): string | null {
  if (!avatarValue) return null;

  if (
    avatarValue.startsWith("http") ||
    avatarValue.startsWith("/") ||
    avatarValue.startsWith("data:")
  ) {
    return avatarValue;
  }

  return selectedAvatarMap[avatarValue] || null;
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
  if (ctx.messageType === "celebration") return "celebrating";
  if (ctx.messageType === "concern") return "concerned";
  if (ctx.messageType === "encouragement") return "encouraging";
  if (ctx.messageType === "question") return "thinking";
  if ((ctx.streak || 0) >= 5) return "celebrating";
  return "happy";
}

/**
 * Detect mood from a coach message text (for chat bubbles).
 */
export function detectMoodFromText(text: string): CoachMood {
  const lower = text.toLowerCase();

  if (/bravo|bravissim[ao]|ottimo|perfetto|eccellente|fantastico|complimenti|ben fatto|hai completato|🎉|✅|💪|🌟/i.test(lower))
    return "celebrating";

  if (/difficolt[àa]|errore|sbagliato|attenzione|non è corrett|riprova|non proprio|purtroppo|hmm/i.test(lower))
    return "concerned";

  if (/forza|dai che|ci sei quasi|continua|non mollare|stai andando|bene così|quasi giusto|buon lavoro|ci siamo/i.test(lower))
    return "encouraging";

  if (/\?|pensa|rifletti|secondo te|prova a|cosa ne pensi|come faresti|perché|qual è/i.test(lower))
    return "thinking";

  return "happy";
}
