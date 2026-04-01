// Coach mood detection utilities — avatar rendering moved to CoachAvatar.tsx

export type CoachMood = "happy" | "thinking" | "encouraging" | "concerned" | "celebrating";

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
