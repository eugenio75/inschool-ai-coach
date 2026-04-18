import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns ONLY the plain Italian interpreted summary (teacherSummary) of the
// student's behavioral profile. Raw parameters are NEVER returned.
// Access is restricted to the teacher of a class the student is enrolled in.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { studentId, classId } = await req.json();
    if (!studentId || !classId) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify the requester owns the teacher profile linked to this class
    const { data: classe } = await admin
      .from("classi").select("docente_profile_id").eq("id", classId).maybeSingle();
    if (!classe) {
      return new Response(JSON.stringify({ error: "Classe non trovata" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: teacherProfile } = await admin
      .from("child_profiles").select("id").eq("id", classe.docente_profile_id).eq("parent_id", user.id).maybeSingle();
    if (!teacherProfile) {
      return new Response(JSON.stringify({ error: "Accesso negato" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the student is enrolled in this class
    const { data: enrollment } = await admin
      .from("class_enrollments").select("id")
      .eq("class_id", classId).eq("student_id", studentId).maybeSingle();
    if (!enrollment) {
      return new Response(JSON.stringify({ error: "Studente non in classe" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read ONLY the interpreted summary — raw behavioral data is never returned
    const { data: prefs } = await admin
      .from("user_preferences").select("adaptive_profile").eq("profile_id", studentId).maybeSingle();

    const adaptive = (prefs?.adaptive_profile as Record<string, any>) || {};
    const behavioral = (adaptive.behavioral as Record<string, any>) || {};
    const summary: string | null = typeof behavioral.teacherSummary === "string" && behavioral.teacherSummary.trim()
      ? behavioral.teacherSummary.trim()
      : null;

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[teacher-student-habits] error", err);
    return new Response(JSON.stringify({ error: "Errore interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
