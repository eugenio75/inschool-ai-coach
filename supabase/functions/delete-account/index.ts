import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the calling user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { action, child_profile_id } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "delete_child_profile") {
      // Verify the child belongs to this user
      const { data: profile, error: profileErr } = await adminClient
        .from("child_profiles")
        .select("id, parent_id")
        .eq("id", child_profile_id)
        .single();

      if (profileErr || !profile || profile.parent_id !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete related data in order (no cascade on some tables)
      const tables = [
        "daily_missions",
        "badges",
        "emotional_checkins",
        "emotional_alerts",
        "parent_notifications",
        "focus_sessions",
        "memory_items",
        "flashcards",
        "homework_tasks",
        "guided_sessions",
        "study_steps",
        "conversation_sessions",
        "sessioni_studio",
        "gamification",
        "user_preferences",
        "class_enrollments",
        "esami_utente",
        "student_materials",
        "material_favorites",
        "ricerche_bibliografiche",
      ];

      for (const table of tables) {
        const col = ["flashcards", "guided_sessions", "study_steps", "learning_errors"].includes(table)
          ? "user_id"
          : ["class_enrollments"].includes(table)
          ? "student_id"
          : ["focus_sessions", "daily_missions", "badges", "emotional_checkins", "emotional_alerts", "parent_notifications", "memory_items", "gamification", "homework_tasks"].includes(table)
          ? "child_profile_id"
          : "profile_id";

        await adminClient.from(table).delete().eq(col, child_profile_id);
      }

      // Delete the child profile itself
      await adminClient.from("child_profiles").delete().eq("id", child_profile_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_account") {
      // Delete all child profiles first (and their data)
      const { data: children } = await adminClient
        .from("child_profiles")
        .select("id")
        .eq("parent_id", userId);

      if (children) {
        for (const child of children) {
          // Recursively clean child data
          const tables = [
            "daily_missions",
            "badges",
            "emotional_checkins",
            "emotional_alerts",
            "parent_notifications",
            "focus_sessions",
            "memory_items",
            "flashcards",
            "homework_tasks",
            "guided_sessions",
            "study_steps",
            "conversation_sessions",
            "sessioni_studio",
            "gamification",
            "user_preferences",
            "class_enrollments",
            "esami_utente",
            "student_materials",
            "material_favorites",
            "ricerche_bibliografiche",
          ];

          for (const table of tables) {
            const col = ["flashcards", "guided_sessions", "study_steps", "learning_errors"].includes(table)
              ? "user_id"
              : ["class_enrollments"].includes(table)
              ? "student_id"
              : ["focus_sessions", "daily_missions", "badges", "emotional_checkins", "emotional_alerts", "parent_notifications", "memory_items", "gamification", "homework_tasks"].includes(table)
              ? "child_profile_id"
              : "profile_id";

            await adminClient.from(table).delete().eq(col, child.id);
          }
        }
      }

      // Delete child profiles
      await adminClient.from("child_profiles").delete().eq("parent_id", userId);

      // Delete parent settings
      await adminClient.from("parent_settings").delete().eq("user_id", userId);

      // Delete user consents
      await adminClient.from("user_consents").delete().eq("user_id", userId);

      // Delete the auth user
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
