import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const userId = prof.parent_id;
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

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

    const last7Sessions = allSessions.slice(0, 7);
    const last7Durations = durations.slice(0, 7);
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

    // Message length average (from messaggi JSON arrays)
    let totalMsgLength = 0;
    let msgCount = 0;
    for (const s of allSessions) {
      const msgs = Array.isArray(s.messaggi) ? s.messaggi : [];
      for (const m of msgs) {
        if (m && (m as any).role === "user" && typeof (m as any).content === "string") {
          totalMsgLength += ((m as any).content as string).length;
          msgCount++;
        }
      }
    }
    const avgMessageLength = msgCount > 0 ? totalMsgLength / msgCount : 0;

    // Determine behavior level
    let behaviorLevel: "NORMALE" | "ATTENZIONE" | "SUPPORTO" | "URGENTE" = "NORMALE";
    let triggers: string[] = [];

    // Check ATTENZIONE triggers (at least 2 of these)
    let attentionSignals = 0;
    if (shortSessions >= 5) { attentionSignals++; triggers.push("sessioni_brevi"); }
    if (lateNightSessions >= 5) { attentionSignals++; triggers.push("accessi_notturni"); }
    // Frequency drop: compare first 7 days vs last 7 days
    const firstWeek = allSessions.filter((s: any) => {
      const d = new Date(s.created_at);
      return d >= new Date(now.getTime() - 14 * 86400000) && d < new Date(now.getTime() - 7 * 86400000);
    }).length;
    const lastWeek = allSessions.filter((s: any) => {
      const d = new Date(s.created_at);
      return d >= new Date(now.getTime() - 7 * 86400000);
    }).length;
    if (firstWeek > 0 && lastWeek < firstWeek * 0.5) {
      attentionSignals++;
      triggers.push("calo_frequenza");
    }

    if (attentionSignals >= 2) behaviorLevel = "ATTENZIONE";

    // Check SUPPORTO: prolonged pattern (10+ days of anomalies)
    if (attentionSignals >= 2 && allSessions.length >= 10) {
      behaviorLevel = "SUPPORTO";
    }

    // Compute overall behavior data
    const behaviorData = {
      sessionDuration: Math.round(avgDuration * 10) / 10,
      sessionFrequency,
      lastSessionAt,
      lateNightSessions,
      shortSessions,
      messageLength: Math.round(avgMessageLength),
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
