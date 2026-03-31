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

    const { teacher_id, class_id } = await req.json();
    if (!teacher_id || !class_id) {
      return new Response(JSON.stringify({ error: "teacher_id e class_id richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify calling user matches teacher_id
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user || user.id !== teacher_id) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check if sample student already exists for this teacher
    const { data: existing } = await admin
      .from("child_profiles")
      .select("id")
      .eq("parent_id", teacher_id)
      .eq("name", "Alunno di Esempio")
      .limit(1);

    if (existing && existing.length > 0) {
      // Already exists — check enrollment
      const studentId = existing[0].id;
      const { data: enrollment } = await admin
        .from("class_enrollments")
        .select("id")
        .eq("class_id", class_id)
        .eq("student_id", studentId)
        .limit(1);

      if (!enrollment || enrollment.length === 0) {
        await admin.from("class_enrollments").insert({
          class_id,
          student_id: studentId,
          status: "active",
        });
        await admin.from("classi").update({ num_studenti: 1 }).eq("id", class_id);
      }

      return new Response(JSON.stringify({ created: false, student_id: studentId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sample student with service role (bypasses RLS)
    const { data: newStudent, error: insertErr } = await admin
      .from("child_profiles")
      .insert({
        parent_id: teacher_id,
        name: "Alunno di Esempio",
        school_level: "media-1",
        age: 12,
        avatar_emoji: "🧑‍🎓",
        onboarding_completed: true,
      })
      .select()
      .single();

    if (insertErr || !newStudent) {
      throw insertErr || new Error("Failed to create sample student");
    }

    // Enroll in sample class
    await admin.from("class_enrollments").insert({
      class_id,
      student_id: newStudent.id,
      status: "active",
    });

    // Update num_studenti
    await admin.from("classi").update({ num_studenti: 1 }).eq("id", class_id);

    return new Response(JSON.stringify({ created: true, student_id: newStudent.id }), {
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
