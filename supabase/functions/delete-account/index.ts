import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function selectIds(
  adminClient: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string | string[],
) {
  if (Array.isArray(value) && value.length === 0) return [] as string[];

  const query = adminClient.from(table).select("id");
  const result = Array.isArray(value)
    ? await query.in(column, value)
    : await query.eq(column, value);

  if (result.error) {
    throw new Error(`Failed reading ${table}: ${result.error.message}`);
  }

  return [...new Set((result.data ?? []).map((row: { id: string }) => row.id).filter(Boolean))];
}

async function deleteWhere(
  adminClient: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string | string[],
) {
  if (Array.isArray(value) && value.length === 0) return;

  const query = adminClient.from(table).delete();
  const result = Array.isArray(value)
    ? await query.in(column, value)
    : await query.eq(column, value);

  if (result.error) {
    throw new Error(`Failed deleting ${table}: ${result.error.message}`);
  }
}

async function cleanupChildProfile(
  adminClient: ReturnType<typeof createClient>,
  childProfileId: string,
) {
  const classIds = await selectIds(adminClient, "classi", "docente_profile_id", childProfileId);
  const conversationIds = await selectIds(adminClient, "conversation_sessions", "profile_id", childProfileId);
  const homeworkIds = await selectIds(adminClient, "homework_tasks", "child_profile_id", childProfileId);

  const guidedSessionIds = [...new Set([
    ...(await selectIds(adminClient, "guided_sessions", "user_id", childProfileId)),
    ...(await selectIds(adminClient, "guided_sessions", "conversation_id", conversationIds)),
    ...(await selectIds(adminClient, "guided_sessions", "homework_id", homeworkIds)),
  ])];

  await deleteWhere(adminClient, "assignment_results", "session_id", guidedSessionIds);
  await deleteWhere(adminClient, "assignment_results", "student_id", childProfileId);

  await deleteWhere(adminClient, "study_steps", "session_id", guidedSessionIds);
  await deleteWhere(adminClient, "study_steps", "homework_id", homeworkIds);
  await deleteWhere(adminClient, "study_steps", "user_id", childProfileId);

  await deleteWhere(adminClient, "flashcards", "source_session_id", guidedSessionIds);
  await deleteWhere(adminClient, "flashcards", "user_id", childProfileId);

  await deleteWhere(adminClient, "learning_errors", "session_id", guidedSessionIds);
  await deleteWhere(adminClient, "learning_errors", "user_id", childProfileId);

  await deleteWhere(adminClient, "guided_sessions", "id", guidedSessionIds);
  await deleteWhere(adminClient, "guided_sessions", "user_id", childProfileId);

  await deleteWhere(adminClient, "focus_sessions", "child_profile_id", childProfileId);
  await deleteWhere(adminClient, "homework_tasks", "child_profile_id", childProfileId);
  await deleteWhere(adminClient, "conversation_sessions", "profile_id", childProfileId);

  const directSpecs = [
    ["daily_missions", "child_profile_id"],
    ["badges", "child_profile_id"],
    ["emotional_checkins", "child_profile_id"],
    ["emotional_alerts", "child_profile_id"],
    ["parent_notifications", "child_profile_id"],
    ["memory_items", "child_profile_id"],
    ["gamification", "child_profile_id"],
    ["user_preferences", "profile_id"],
    ["class_enrollments", "student_id"],
    ["esami_utente", "profile_id"],
    ["student_materials", "profile_id"],
    ["material_favorites", "profile_id"],
    ["ricerche_bibliografiche", "profile_id"],
    ["sessioni_studio", "profile_id"],
    ["teacher_assignments", "student_id"],
    ["parent_communications", "student_id"],
    ["teacher_activity_feed", "student_id"],
    ["verifiche", "docente_profile_id"],
  ] as const;

  for (const [table, column] of directSpecs) {
    await deleteWhere(adminClient, table, column, childProfileId);
  }

  if (classIds.length > 0) {
    await deleteWhere(adminClient, "class_enrollments", "class_id", classIds);
    await deleteWhere(adminClient, "teacher_assignments", "class_id", classIds);
    await deleteWhere(adminClient, "parent_communications", "class_id", classIds);
    await deleteWhere(adminClient, "teacher_activity_feed", "class_id", classIds);
    await deleteWhere(adminClient, "teacher_calendar_events", "class_id", classIds);
    await deleteWhere(adminClient, "teacher_chats", "class_id", classIds);
    await deleteWhere(adminClient, "teacher_materials", "class_id", classIds);
    await deleteWhere(adminClient, "classi", "id", classIds);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify the calling user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;
    const body = await req.json();
    const { action, child_profile_id } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "delete_child_profile") {
      const { data: profile, error: profileErr } = await adminClient
        .from("child_profiles")
        .select("id, parent_id")
        .eq("id", child_profile_id)
        .single();

      if (profileErr || !profile || profile.parent_id !== userId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      await cleanupChildProfile(adminClient, child_profile_id);

      const { error: deleteProfileError } = await adminClient
        .from("child_profiles")
        .delete()
        .eq("id", child_profile_id);

      if (deleteProfileError) {
        throw new Error(`Failed deleting child profile: ${deleteProfileError.message}`);
      }

      return jsonResponse({ success: true });
    }

    if (action === "delete_account") {
      const { data: children } = await adminClient
        .from("child_profiles")
        .select("id")
        .eq("parent_id", userId);

      if (children) {
        for (const child of children) {
          await cleanupChildProfile(adminClient, child.id);
        }
      }

      const { error: deleteChildrenError } = await adminClient
        .from("child_profiles")
        .delete()
        .eq("parent_id", userId);
      if (deleteChildrenError) {
        throw new Error(`Failed deleting child profiles: ${deleteChildrenError.message}`);
      }

      await deleteWhere(adminClient, "parent_settings", "user_id", userId);
      await deleteWhere(adminClient, "user_consents", "user_id", userId);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        return jsonResponse({ error: deleteError.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("delete-account error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
