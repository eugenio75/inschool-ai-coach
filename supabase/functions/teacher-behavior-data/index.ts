import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const crisisKeywords = [
  "non ce la faccio",
  "voglio mollare",
  "non ha senso",
  "lascio tutto",
  "non reggo",
  "sono a pezzi",
  "non riesco più",
  "non riesco piu",
  "mollo tutto",
  "non vale la pena",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { teacherProfileId } = await req.json();
    if (!teacherProfileId) throw new Error("teacherProfileId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Get parent_id (auth user) from child_profiles (teacher profile)
    const { data: prof } = await sb
      .from("child_profiles")
      .select("parent_id")
      .eq("id", teacherProfileId)
      .single();
    if (!prof) throw new Error("Profile not found");

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    // Fetch conversation sessions (as proxy for teacher sessions)
    const { data: sessions } = await sb
      .from("conversation_sessions")
      .select("created_at, updated_at, messaggi")
      .eq("profile_id", teacherProfileId)
      .gte("created_at", fourteenDaysAgo)
      .order("created_at", { ascending: false });

    const allSessions = sessions || [];

    // Session duration estimates (from created_at to updated_at)
    const durations = allSessions.map((s: any) => {
      const start = new Date(s.created_at).getTime();
      const end = new Date(s.updated_at || s.created_at).getTime();
      return Math.max(0, (end - start) / 1000 / 60); // minutes
    });

    const last7Sessions = allSessions.filter((s: any) => new Date(s.created_at) >= sevenDaysAgo);
    const last7Durations = last7Sessions.map((s: any) => {
      const start = new Date(s.created_at).getTime();
      const end = new Date(s.updated_at || s.created_at).getTime();
      return Math.max(0, (end - start) / 1000 / 60);
    });
    const avgDuration = last7Durations.length > 0
      ? last7Durations.reduce((a: number, b: number) => a + b, 0) / last7Durations.length
      : 0;

    // Session frequency (last 14 days)
    const sessionFrequency = allSessions.length;

    // Last session timestamp
    const lastSessionAt = allSessions.length > 0 ? allSessions[0].created_at : null;

    // Days since last access
    const daysSinceLastAccess = lastSessionAt
      ? Math.floor((now.getTime() - new Date(lastSessionAt).getTime()) / 86400000)
      : 999;

    // Late night sessions (after 22:00)
    const lateNightSessions = allSessions.filter((s: any) => {
      const hour = new Date(s.created_at).getHours();
      return hour >= 22 || hour < 5;
    }).length;

    // Short sessions (< 3 min)
    const shortSessions = durations.filter((d: number) => d < 3).length;

    // ── Message length analysis split by week ──
    let totalMsgLengthRecent = 0, msgCountRecent = 0;
    let totalMsgLengthPrevious = 0, msgCountPrevious = 0;

    for (const s of allSessions) {
      const sessionDate = new Date(s.created_at);
      const isRecent = sessionDate >= sevenDaysAgo;
      const msgs = Array.isArray(s.messaggi) ? s.messaggi : [];
      for (const m of msgs) {
        if (m && (m as any).role === "user" && typeof (m as any).content === "string") {
          const len = ((m as any).content as string).length;
          if (isRecent) {
            totalMsgLengthRecent += len;
            msgCountRecent++;
          } else {
            totalMsgLengthPrevious += len;
            msgCountPrevious++;
          }
        }
      }
    }

    const avgMessageLengthRecent = msgCountRecent > 0 ? totalMsgLengthRecent / msgCountRecent : 0;
    const avgMessageLengthPrevious = msgCountPrevious > 0 ? totalMsgLengthPrevious / msgCountPrevious : 0;
    const avgMessageLength = (msgCountRecent + msgCountPrevious) > 0
      ? (totalMsgLengthRecent + totalMsgLengthPrevious) / (msgCountRecent + msgCountPrevious)
      : 0;

    // Message length drop: >50% decrease from previous week to recent week
    const messageLengthDrop = avgMessageLengthPrevious > 0 &&
      ((avgMessageLengthPrevious - avgMessageLengthRecent) / avgMessageLengthPrevious) > 0.5;

    // ── Determine behavior level ──
    let behaviorLevel: "NORMALE" | "ATTENZIONE" | "SUPPORTO" | "URGENTE" = "NORMALE";
    let triggers: string[] = [];

    // Check ATTENZIONE triggers (at least 2 of these)
    let attentionSignals = 0;
    if (shortSessions >= 5) { attentionSignals++; triggers.push("sessioni_brevi"); }
    if (lateNightSessions >= 5) { attentionSignals++; triggers.push("accessi_notturni"); }

    // Frequency drop: compare first 7 days vs last 7 days
    const firstWeek = allSessions.filter((s: any) => {
      const d = new Date(s.created_at);
      return d >= new Date(now.getTime() - 14 * 86400000) && d < sevenDaysAgo;
    }).length;
    const lastWeek = last7Sessions.length;
    if (firstWeek > 0 && lastWeek < firstWeek * 0.5) {
      attentionSignals++;
      triggers.push("calo_frequenza");
    }

    // FIX 3: Message length drop as additional signal
    if (messageLengthDrop) {
      attentionSignals++;
      triggers.push("calo_comunicazione");
    }

    if (attentionSignals >= 2) behaviorLevel = "ATTENZIONE";

    // Check SUPPORTO: prolonged pattern (10+ days of anomalies)
    if (attentionSignals >= 2 && allSessions.length >= 10) {
      behaviorLevel = "SUPPORTO";
    }

    // ── FIX 2: URGENTE — crisis keyword detection in recent messages ──
    let hasCrisisSignal = false;
    // Scan last 5 user messages across all recent sessions
    const recentUserMessages: string[] = [];
    for (const s of allSessions) {
      const msgs = Array.isArray(s.messaggi) ? s.messaggi : [];
      for (const m of msgs) {
        if (m && (m as any).role === "user" && typeof (m as any).content === "string") {
          recentUserMessages.push(((m as any).content as string).toLowerCase());
        }
      }
      if (recentUserMessages.length >= 5) break;
    }

    hasCrisisSignal = recentUserMessages.slice(0, 5).some(msg =>
      crisisKeywords.some(kw => msg.includes(kw))
    );

    if (hasCrisisSignal) {
      behaviorLevel = "URGENTE";
      if (!triggers.includes("segnale_crisi")) triggers.push("segnale_crisi");
    }

    // Compute overall behavior data
    const behaviorData = {
      sessionDuration: Math.round(avgDuration * 10) / 10,
      sessionFrequency,
      lastSessionAt,
      lateNightSessions,
      shortSessions,
      messageLength: Math.round(avgMessageLength),
      messageLengthDrop,
      daysSinceLastAccess,
      behaviorLevel,
      triggers,
    };

    // Save to user_preferences for injection into coach prompts
    await sb.from("user_preferences").upsert({
      profile_id: teacherProfileId,
      role: "docente",
      data: { teacherBehavior: behaviorData },
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    return new Response(JSON.stringify(behaviorData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("teacher-behavior-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
