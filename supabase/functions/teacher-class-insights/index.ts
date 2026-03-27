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
    const { data: profiles } = await admin
      .from("child_profiles")
      .select("id, parent_id, name, avatar_emoji")
      .in("parent_id", studentUserIds);

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

    // ── 1. Format Distribution ──
    // Per subject, count how many students have each format as bestLearningStyle
    const formatDistribution: Record<
      string,
      Record<string, number>
    > = {};

    profileIds.forEach((pid: string) => {
      const prefs = prefsMap[pid];
      if (!prefs) return;
      const adaptive = (prefs.adaptive_profile || {}) as Record<string, any>;
      const cognitive = (prefs.cognitive_dynamic_profile || {}) as Record<
        string,
        any
      >;
      const bySubject = adaptive.bySubject || {};

      // Check global bestLearningStyle
      const globalStyle = cognitive.bestLearningStyle || "non definito";

      // Aggregate per subject from bySubject keys
      const subjects = Object.keys(bySubject);
      if (subjects.length === 0) {
        // Use global only
        const key = "generale";
        if (!formatDistribution[key]) formatDistribution[key] = {};
        formatDistribution[key][globalStyle] =
          (formatDistribution[key][globalStyle] || 0) + 1;
      } else {
        subjects.forEach((subj) => {
          if (!formatDistribution[subj]) formatDistribution[subj] = {};
          // Use global style for now (per-subject style calculation happens in ai-chat)
          formatDistribution[subj][globalStyle] =
            (formatDistribution[subj][globalStyle] || 0) + 1;
        });
      }
    });

    // ── 2. Frustration Alerts ──
    // Students where hesitationScore > 0.5 AND avgHintsPerSession > 3
    // for at least one subject with >= 3 sessions
    const frustrationAlerts: Array<{
      studentName: string;
      subject: string;
      hesitationScore: number;
      avgHints: number;
      sessions: number;
    }> = [];

    profileIds.forEach((pid: string) => {
      const prefs = prefsMap[pid];
      if (!prefs) return;
      const adaptive = (prefs.adaptive_profile || {}) as Record<string, any>;
      const bySubject = adaptive.bySubject || {};
      const student = profileById[pid];
      const studentName = student?.name || "Studente";

      Object.entries(bySubject).forEach(([subj, data]: [string, any]) => {
        if (
          (data.sessionCount || 0) >= 3 &&
          (data.hesitationScore || 0) > 0.5 &&
          (data.avgHintsPerSession || 0) > 3
        ) {
          frustrationAlerts.push({
            studentName,
            subject: subj,
            hesitationScore: Math.round((data.hesitationScore || 0) * 100) / 100,
            avgHints:
              Math.round((data.avgHintsPerSession || 0) * 10) / 10,
            sessions: data.sessionCount || 0,
          });
        }
      });

      // Also check global if no bySubject
      if (
        Object.keys(bySubject).length === 0 &&
        (adaptive.sessionCount || 0) >= 3 &&
        (adaptive.hesitationScore || 0) > 0.5 &&
        (adaptive.avgHintsPerSession || 0) > 3
      ) {
        frustrationAlerts.push({
          studentName,
          subject: "generale",
          hesitationScore:
            Math.round((adaptive.hesitationScore || 0) * 100) / 100,
          avgHints:
            Math.round((adaptive.avgHintsPerSession || 0) * 10) / 10,
          sessions: adaptive.sessionCount || 0,
        });
      }
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
