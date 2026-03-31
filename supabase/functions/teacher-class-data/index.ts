import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: teacherProfiles, error: teacherProfilesError } = await admin
      .from("child_profiles")
      .select("id")
      .eq("parent_id", user.id)
      .eq("school_level", "docente");

    if (teacherProfilesError) throw teacherProfilesError;

    const teacherProfileIds = (teacherProfiles || []).map((profile) => profile.id);
    if (teacherProfileIds.length === 0) {
      return new Response(JSON.stringify({ error: "Classe non trovata" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: classe, error: classeError } = await admin
      .from("classi")
      .select("*")
      .eq("id", classId)
      .in("docente_profile_id", teacherProfileIds)
      .maybeSingle();

    if (classeError) throw classeError;
    if (!classe) {
      return new Response(JSON.stringify({ error: "Classe non trovata" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enrollments, error: enrollmentsError } = await admin
      .from("class_enrollments")
      .select("id, class_id, student_id, status, enrolled_at")
      .eq("class_id", classId)
      .eq("status", "active");

    if (enrollmentsError) throw enrollmentsError;

    const studentIds = (enrollments || []).map((enrollment) => enrollment.student_id);

    let profilesList: Array<{
      id: string;
      parent_id: string;
      name: string;
      avatar_emoji: string | null;
      school_level: string | null;
    }> = [];

    if (studentIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from("child_profiles")
        .select("id, parent_id, name, avatar_emoji, school_level")
        .in("id", studentIds);

      if (profilesError) throw profilesError;
      profilesList = profiles || [];
    }

    const profileMap = Object.fromEntries(
      profilesList.map((profile) => [profile.parent_id, profile]),
    );

    const students = (enrollments || []).map((enrollment) => ({
      ...enrollment,
      profile: profileMap[enrollment.student_id] || null,
    }));

    const { data: assignments, error: assignmentsError } = await admin
      .from("teacher_assignments")
      .select("*")
      .eq("teacher_id", user.id)
      .eq("class_id", classId)
      .order("assigned_at", { ascending: false });

    if (assignmentsError) throw assignmentsError;

    let assignmentResults: any[] = [];
    const assignmentIds = (assignments || []).map((assignment) => assignment.id);

    if (assignmentIds.length > 0) {
      const { data: results, error: resultsError } = await admin
        .from("assignment_results")
        .select("*")
        .in("assignment_id", assignmentIds);

      if (resultsError) throw resultsError;

      const studentNameMap = Object.fromEntries(
        profilesList.map((profile) => [profile.parent_id, profile.name]),
      );

      assignmentResults = (assignments || [])
        .map((assignment) => ({
          ...assignment,
          results: (results || [])
            .filter((result) => result.assignment_id === assignment.id)
            .map((result) => ({
              ...result,
              student_name: studentNameMap[result.student_id] || "Studente",
            })),
        }))
        .filter((assignment) => assignment.results.length > 0);
    }

    return new Response(JSON.stringify({ classe, students, assignmentResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});