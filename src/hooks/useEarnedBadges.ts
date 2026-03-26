import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveChildProfileId } from "@/lib/database";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { subDays, format } from "date-fns";

export interface EarnedBadge {
  id: string;
  type: "streak" | "first_test" | "improvement" | "first_review" | "daily_complete";
  emoji: string;
  label: string;
  earnedAt: string;
}

type SchoolLevel = "elementari" | "medie" | "superiori" | "universitario";

const BADGE_LABELS: Record<string, Record<SchoolLevel, { emoji: string; label: string }>> = {
  streak: {
    elementari: { emoji: "🔥", label: "giorni di fila — sei in forma!" },
    medie: { emoji: "🔥", label: "giorni consecutivi" },
    superiori: { emoji: "", label: "giorni consecutivi di studio" },
    universitario: { emoji: "", label: "Continuità mantenuta questa settimana" },
  },
  first_test: {
    elementari: { emoji: "⭐", label: "Hai completato la tua prima verifica!" },
    medie: { emoji: "⭐", label: "Prima verifica completata" },
    superiori: { emoji: "", label: "Verifica completata sopra la soglia" },
    universitario: { emoji: "", label: "Esame preparato con anticipo" },
  },
  improvement: {
    elementari: { emoji: "📈", label: "Stai migliorando — ottimo lavoro!" },
    medie: { emoji: "📈", label: "Stai migliorando in questa materia" },
    superiori: { emoji: "", label: "Miglioramento rispetto alla settimana scorsa" },
    universitario: { emoji: "", label: "Miglioramento registrato" },
  },
  first_review: {
    elementari: { emoji: "🔁", label: "Hai ripassato per la prima volta!" },
    medie: { emoji: "🔁", label: "Hai ripassato per la prima volta" },
    superiori: { emoji: "", label: "Hai ripassato prima della scadenza" },
    universitario: { emoji: "", label: "Ripasso distribuito completato" },
  },
  daily_complete: {
    elementari: { emoji: "✅", label: "Tutti i compiti di oggi fatti!" },
    medie: { emoji: "✅", label: "Giornata completata" },
    superiori: { emoji: "", label: "Tutti i compiti della giornata completati" },
    universitario: { emoji: "", label: "Obiettivo giornaliero raggiunto" },
  },
};

function getLevel(profile: any): SchoolLevel {
  const sl = profile?.school_level || "";
  if (sl === "universitario") return "universitario";
  if (sl === "superiori") return "superiori";
  if (sl === "medie") return "medie";
  return "elementari";
}

export function useEarnedBadges() {
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    evaluate();
  }, []);

  async function evaluate() {
    try {
      const isChild = isChildSession();
      const profileId = isChild ? getChildSession()?.profileId : getActiveChildProfileId();
      if (!profileId) { setLoading(false); return; }

      // Get profile for school_level
      let profile: any = null;
      if (isChild) {
        profile = getChildSession()?.profile;
      } else {
        const { data } = await supabase.from("child_profiles").select("school_level").eq("id", profileId).maybeSingle();
        profile = data;
      }
      const level = getLevel(profile);
      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const earned: EarnedBadge[] = [];

      // 1. Streak check (3+ days)
      const sevenAgo = subDays(now, 10).toISOString();
      const { data: sessions } = await supabase
        .from("focus_sessions" as any)
        .select("completed_at")
        .eq("child_profile_id", profileId)
        .gte("completed_at", sevenAgo);

      if (sessions && sessions.length > 0) {
        const days = new Set(sessions.map((s: any) => format(new Date(s.completed_at), "yyyy-MM-dd")));
        let streak = 0;
        let check = now;
        while (days.has(format(check, "yyyy-MM-dd"))) { streak++; check = subDays(check, 1); }
        if (streak >= 3) {
          const meta = BADGE_LABELS.streak[level];
          const label = level === "elementari" || level === "medie"
            ? `${streak} ${meta.label}`
            : level === "universitario" ? meta.label : `${streak} ${meta.label}`;
          earned.push({ id: "streak", type: "streak", emoji: meta.emoji, label, earnedAt: today });
        }
      }

      // 2. First test completed (guided_sessions completed)
      const { data: completedSessions } = await supabase
        .from("guided_sessions" as any)
        .select("id, completed_at")
        .eq("user_id", profileId)
        .eq("status", "completed")
        .limit(1);

      if (completedSessions && completedSessions.length > 0) {
        const meta = BADGE_LABELS.first_test[level];
        earned.push({ id: "first_test", type: "first_test", emoji: meta.emoji, label: meta.label, earnedAt: today });
      }

      // 3. Improvement: more focus sessions this week vs last week
      const weekAgo = subDays(now, 7).toISOString();
      const twoWeeksAgo = subDays(now, 14).toISOString();
      const { data: thisWeek } = await supabase
        .from("focus_sessions" as any)
        .select("id")
        .eq("child_profile_id", profileId)
        .gte("completed_at", weekAgo);
      const { data: lastWeek } = await supabase
        .from("focus_sessions" as any)
        .select("id")
        .eq("child_profile_id", profileId)
        .gte("completed_at", twoWeeksAgo)
        .lt("completed_at", weekAgo);

      if ((thisWeek?.length || 0) > (lastWeek?.length || 0) && (lastWeek?.length || 0) > 0) {
        const meta = BADGE_LABELS.improvement[level];
        earned.push({ id: "improvement", type: "improvement", emoji: meta.emoji, label: meta.label, earnedAt: today });
      }

      // 4. First review (memory_items with last_reviewed)
      const { data: reviewed } = await supabase
        .from("memory_items" as any)
        .select("id")
        .eq("child_profile_id", profileId)
        .not("last_reviewed", "is", null)
        .limit(1);

      if (reviewed && reviewed.length > 0) {
        const meta = BADGE_LABELS.first_review[level];
        earned.push({ id: "first_review", type: "first_review", emoji: meta.emoji, label: meta.label, earnedAt: today });
      }

      // 5. All daily tasks completed
      const { data: todayTasks } = await supabase
        .from("homework_tasks" as any)
        .select("id, completed")
        .eq("child_profile_id", profileId);

      if (todayTasks && todayTasks.length > 0) {
        const allDone = todayTasks.every((t: any) => t.completed);
        if (allDone) {
          const meta = BADGE_LABELS.daily_complete[level];
          earned.push({ id: "daily_complete", type: "daily_complete", emoji: meta.emoji, label: meta.label, earnedAt: today });
        }
      }

      // Max 2 most relevant — prioritize streak, daily_complete, then others
      const priority = ["daily_complete", "streak", "improvement", "first_test", "first_review"];
      earned.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
      setBadges(earned.slice(0, 2));
    } catch (err) {
      console.error("Badge evaluation error:", err);
    } finally {
      setLoading(false);
    }
  }

  return { badges, loading };
}
