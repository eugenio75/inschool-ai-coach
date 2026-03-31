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

    const body = await req.json();
    const { teacher_id } = body;
    // class_id is optional now — we find the existing sample class
    if (!teacher_id) {
      return new Response(JSON.stringify({ error: "teacher_id richiesto" }), {
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

    // Step 1: Find teacher's profile to get docente_profile_id
    console.log("[create-sample-data] Step 1: Finding teacher profile for user", teacher_id);
    const { data: teacherProfile } = await admin
      .from("child_profiles")
      .select("id")
      .eq("parent_id", teacher_id)
      .eq("school_level", "docente")
      .limit(1)
      .single();

    if (!teacherProfile) {
      console.log("[create-sample-data] No teacher profile found, aborting");
      return new Response(JSON.stringify({ error: "Profilo docente non trovato" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[create-sample-data] Teacher profile found:", teacherProfile.id);

    // Step 2: Find existing sample class
    console.log("[create-sample-data] Step 2: Finding existing sample class");
    let sampleClassId = body.class_id; // fallback to passed class_id

    const { data: existingClass } = await admin
      .from("classi")
      .select("id, nome")
      .eq("is_sample", true)
      .eq("docente_profile_id", teacherProfile.id)
      .limit(1)
      .single();

    if (existingClass) {
      sampleClassId = existingClass.id;
      console.log("[create-sample-data] Existing sample class found:", existingClass.id, existingClass.nome);
    } else if (!sampleClassId) {
      console.log("[create-sample-data] No sample class found and no class_id provided, aborting");
      return new Response(JSON.stringify({ error: "Nessuna classe di esempio trovata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.log("[create-sample-data] No sample class found, using provided class_id:", sampleClassId);
    }

    // Step 3: Check if sample student already exists
    console.log("[create-sample-data] Step 3: Checking for existing sample student");
    const { data: existing } = await admin
      .from("child_profiles")
      .select("id")
      .eq("parent_id", teacher_id)
      .eq("name", "Alunno di Esempio")
      .limit(1);

    if (existing && existing.length > 0) {
      const studentId = existing[0].id;
      console.log("[create-sample-data] Sample student already exists:", studentId);

      // Check enrollment
      const { data: enrollment } = await admin
        .from("class_enrollments")
        .select("id")
        .eq("class_id", sampleClassId)
        .eq("student_id", studentId)
        .limit(1);

      if (!enrollment || enrollment.length === 0) {
        console.log("[create-sample-data] Enrolling existing student in sample class");
        await admin.from("class_enrollments").insert({
          class_id: sampleClassId,
          student_id: studentId,
          status: "active",
        });
        await admin.from("classi").update({ num_studenti: 1 }).eq("id", sampleClassId);
        console.log("[create-sample-data] Enrollment created and num_studenti updated");
      } else {
        console.log("[create-sample-data] Student already enrolled, nothing to do");
      }

      return new Response(JSON.stringify({ created: false, student_id: studentId, class_id: sampleClassId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Create sample student
    console.log("[create-sample-data] Step 4: Creating sample student");
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
      console.error("[create-sample-data] Failed to create student:", insertErr?.message);
      throw insertErr || new Error("Failed to create sample student");
    }
    console.log("[create-sample-data] Sample student created:", newStudent.id);

    // Step 5: Enroll in sample class
    console.log("[create-sample-data] Step 5: Enrolling student in class", sampleClassId);
    const { error: enrollErr } = await admin.from("class_enrollments").insert({
      class_id: sampleClassId,
      student_id: newStudent.id,
      status: "active",
    });
    if (enrollErr) {
      console.error("[create-sample-data] Enrollment error:", enrollErr.message);
    } else {
      console.log("[create-sample-data] Enrollment successful");
    }

    // Step 6: Update num_studenti
    console.log("[create-sample-data] Step 6: Updating num_studenti");
    await admin.from("classi").update({ num_studenti: 1 }).eq("id", sampleClassId);
    console.log("[create-sample-data] num_studenti updated to 1");

    return new Response(JSON.stringify({ created: true, student_id: newStudent.id, class_id: sampleClassId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";
    console.error("[create-sample-data] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
