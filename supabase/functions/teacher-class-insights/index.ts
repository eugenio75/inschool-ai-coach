import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { classId } = await req.json();
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId mancante" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate teacher
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify teacher owns this class
    const { data: teacherProfiles } = await admin
      .from("child_profiles")
      .select("id")
      .eq("parent_id", user.id)
      .eq("school_level", "docente");

    const teacherProfileIds = (teacherProfiles || []).map((p: any) => p.id);
    if (teacherProfileIds.length === 0) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: classe } = await admin
      .from("classi")
      .select("id, materia")
      .eq("id", classId)
      .in("docente_profile_id", teacherProfileIds)
      .maybeSingle();

    if (!classe) {
      return new Response(JSON.stringify({ error: "Classe non trovata" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get enrolled students
    const { data: enrollments } = await admin
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("status", "active");

    const studentUserIds = (enrollments || []).map((e: any) => e.student_id);

    if (studentUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          formatDistribution: {},
          frustrationAlerts: [],
          hardTopics: [],
          moodAtRisk: [],
          totalStudents: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get child_profiles for these student user IDs
    // Fix 5: Only include students with consent
    const { data: profiles } = await admin
      .from("child_profiles")
      .select("id, parent_id, name, avatar_emoji, teacher_insights_consent")
      .in("parent_id", studentUserIds)
      .eq("teacher_insights_consent", true);

    const profilesList = profiles || [];
    const profileIds = profilesList.map((p: any) => p.id);
    const profileByParent: Record<string, any> = {};
    const profileById: Record<string, any> = {};
    profilesList.forEach((p: any) => {
      profileByParent[p.parent_id] = p;
      profileById[p.id] = p;
    });

    // Fetch all needed data in parallel
    const fourteenDaysAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [prefsRes, checkinsRes, errorsRes] = await Promise.all([
      // User preferences (adaptive_profile, cognitive_dynamic_profile, mood_streak)
      admin
        .from("user_preferences")
        .select(
          "profile_id, adaptive_profile, cognitive_dynamic_profile, mood_streak"
        )
        .in("profile_id", profileIds),
      // Emotional checkins last 14 days
      admin
        .from("emotional_checkins")
        .select("child_profile_id, emotional_tone, energy_level, checkin_date")
        .in("child_profile_id", profileIds)
        .gte("created_at", fourteenDaysAgo),
      // Unresolved learning errors
      admin
        .from("learning_errors")
        .select("user_id, subject, topic, description")
        .in("user_id", studentUserIds)
        .eq("resolved", false),
    ]);

    const prefsMap: Record<string, any> = {};
    (prefsRes.data || []).forEach((p: any) => {
      prefsMap[p.profile_id] = p;
    });

    // ── 1. Format Distribution (Fix 3: use per-subject formatPerformance) ──
    const formatDistribution: Record<string, Record<string, number>> = {};
    const styleMap: Record<string, string> = {
      schema: "logico",
      text: "narrativo",
      dialogue: "analogico",
      example: "visivo",
    };

    profileIds.forEach((pid: string) => {
      const prefs = prefsMap[pid];
      if (!prefs) return;
      const adaptive = (prefs.adaptive_profile || {}) as Record<string, any>;
      const bySubject = adaptive.bySubject || {};

      // For each subject this student has data for, determine best format from formatPerformance
      Object.entries(bySubject).forEach(([subj, subjData]: [string, any]) => {
        const fp = (subjData as any).formatPerformance || (adaptive.formatPerformance || {});
        // Find the format with most sessions (as best proxy for observed preference)
        const categories = ["schema", "text", "dialogue", "example"];
        const eligible = categories.filter(c => (fp[c]?.sessions || 0) >= 1);
        if (eligible.length === 0) return; // No format data — exclude from distribution

        // Pick best: lowest avgHintsPerSession + highest avgBloomReached (same logic as ai-chat)
        let bestFormat = eligible[0];
        if (eligible.length >= 2) {
          const scored = eligible.map(c => ({
            category: c,
            hints: fp[c]?.avgHintsPerSession || 999,
            bloom: fp[c]?.avgBloomReached || 0,
          }));
          const byHints = [...scored].sort((a, b) => a.hints - b.hints);
          const byBloom = [...scored].sort((a, b) => b.bloom - a.bloom);
          const rankMap: Record<string, number> = {};
          byHints.forEach((s, i) => { rankMap[s.category] = i; });
          byBloom.forEach((s, i) => { rankMap[s.category] = (rankMap[s.category] || 0) + i; });
          bestFormat = Object.entries(rankMap).sort((a, b) => a[1] - b[1])[0][0];
        }

        const styleName = styleMap[bestFormat] || bestFormat;
        if (!formatDistribution[subj]) formatDistribution[subj] = {};
        formatDistribution[subj][styleName] = (formatDistribution[subj][styleName] || 0) + 1;
      });
      // If student has no bySubject data, exclude from distribution (do not fall back to global)
    });

    // ── 2. Frustration Alerts (Fix 4: check consecutive sessions) ──
    const frustrationAlerts: Array<{
      studentName: string;
      subject: string;
      hesitationScore: number;
      avgHints: number;
      consecutiveBad: number;
    }> = [];

    profileIds.forEach((pid: string) => {
      const prefs = prefsMap[pid];
      if (!prefs) return;
      const adaptive = (prefs.adaptive_profile || {}) as Record<string, any>;
      const bySubject = adaptive.bySubject || {};
      const student = profileById[pid];
      const studentName = student?.name || "Studente";

      Object.entries(bySubject).forEach(([subj, data]: [string, any]) => {
        // Use methodBlockHistory to check consecutive bad sessions
        const history: any[] = data.methodBlockHistory || adaptive.methodBlockHistory || [];
        if (history.length < 3) {
          // Fall back to current aggregate if no history — but require >= 3 sessions
          if (
            (data.sessionCount || 0) >= 3 &&
            (data.hesitationScore || 0) > 0.5 &&
            (data.avgHintsPerSession || 0) > 3
          ) {
            frustrationAlerts.push({
              studentName,
              subject: subj,
              hesitationScore: Math.round((data.hesitationScore || 0) * 100) / 100,
              avgHints: Math.round((data.avgHintsPerSession || 0) * 10) / 10,
              consecutiveBad: data.sessionCount || 0,
            });
          }
          return;
        }

        // Count consecutive bad sessions from the most recent backward
        let consecutiveBad = 0;
        for (let i = history.length - 1; i >= 0; i--) {
          const entry = history[i];
          // A session is "bad" if bloom is low (<=2) and voice success is low
          // Since we don't have per-entry hints, use the overall subject metrics
          // with the recency check: if the latest entries show low bloom, flag it
          if ((entry.bloomReached || 0) <= 2) {
            consecutiveBad++;
          } else {
            break; // Good session breaks the streak
          }
        }

        if (
          consecutiveBad >= 3 &&
          (data.hesitationScore || 0) > 0.5 &&
          (data.avgHintsPerSession || 0) > 3
        ) {
          frustrationAlerts.push({
            studentName,
            subject: subj,
            hesitationScore: Math.round((data.hesitationScore || 0) * 100) / 100,
            avgHints: Math.round((data.avgHintsPerSession || 0) * 10) / 10,
            consecutiveBad,
          });
        }
      });
    });

    // ── 3. Hard Topics ──
    // Subjects/topics where unresolved learning_errors > 30% of class
    const errorsByTopic: Record<
      string,
      Set<string>
    > = {};
    (errorsRes.data || []).forEach((err: any) => {
      const key = `${err.subject || "Generale"}${err.topic ? ` — ${err.topic}` : ""}`;
      if (!errorsByTopic[key]) errorsByTopic[key] = new Set();
      errorsByTopic[key].add(err.user_id);
    });

    const totalStudents = studentUserIds.length;
    const threshold = Math.max(1, Math.ceil(totalStudents * 0.3));
    const hardTopics: Array<{
      topic: string;
      affectedStudents: number;
      percentage: number;
    }> = [];

    Object.entries(errorsByTopic).forEach(([topic, students]) => {
      if (students.size >= threshold) {
        hardTopics.push({
          topic,
          affectedStudents: students.size,
          percentage: Math.round((students.size / totalStudents) * 100),
        });
      }
    });
    hardTopics.sort((a, b) => b.percentage - a.percentage);

    // ── 4. Mood at Risk ──
    // Students with mood_streak >= 5 (approaching CONCERN)
    const moodAtRisk: Array<{
      studentName: string;
      moodStreak: number;
      recentTone: string;
    }> = [];

    profileIds.forEach((pid: string) => {
      const prefs = prefsMap[pid];
      if (!prefs) return;
      const moodStreak = prefs.mood_streak || 0;
      if (moodStreak >= 5) {
        const student = profileById[pid];
        // Get most recent checkin for tone
        const checkins = (checkinsRes.data || []).filter(
          (c: any) => c.child_profile_id === pid
        );
        const latest = checkins.sort(
          (a: any, b: any) =>
            new Date(b.checkin_date).getTime() -
            new Date(a.checkin_date).getTime()
        )[0];
        moodAtRisk.push({
          studentName: student?.name || "Studente",
          moodStreak,
          recentTone: latest?.emotional_tone || "unknown",
        });
      }
    });
    moodAtRisk.sort((a, b) => b.moodStreak - a.moodStreak);

    return new Response(
      JSON.stringify({
        formatDistribution,
        frustrationAlerts,
        hardTopics,
        moodAtRisk,
        totalStudents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";
    console.error("teacher-class-insights error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
