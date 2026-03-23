import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { classId, teacherId, assignmentId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get assignment info
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (!assignment) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count enrollments
    const { count: totalStudents } = await supabase
      .from("class_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("status", "active");

    // Count completed results
    const { data: results } = await supabase
      .from("assignment_results")
      .select("*")
      .eq("assignment_id", assignmentId);

    const completed = (results || []).filter(r => r.status === "completed").length;
    const total = totalStudents || 0;
    const completionRate = total > 0 ? completed / total : 0;

    // Get common errors
    const { data: errors } = await supabase
      .from("learning_errors")
      .select("topic, error_type")
      .eq("session_id", assignmentId);

    const topicCounts: Record<string, number> = {};
    for (const e of (errors || [])) {
      if (e.topic) topicCounts[e.topic] = (topicCounts[e.topic] || 0) + 1;
    }
    const commonErrors = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Generate feed items
    const feedItems: any[] = [];

    if (total > 0 && completionRate < 0.7) {
      feedItems.push({
        teacher_id: teacherId,
        class_id: classId,
        type: "completion_low",
        severity: "warning",
        message: `Solo ${completed}/${total} studenti hanno completato "${assignment.title}". Vuoi inviare un promemoria?`,
        action_label: "Vai alla classe",
        action_route: `/classe/${classId}`,
      });
    }

    if (commonErrors.length > 0 && commonErrors[0][1] >= 4) {
      feedItems.push({
        teacher_id: teacherId,
        class_id: classId,
        type: "common_error",
        severity: "warning",
        message: `${commonErrors[0][1]} studenti hanno difficoltà su "${commonErrors[0][0]}". Suggerito: recupero mirato.`,
        action_label: "Prepara recupero",
        action_route: `/classe/${classId}`,
      });
    }

    if (completionRate >= 0.8) {
      feedItems.push({
        teacher_id: teacherId,
        class_id: classId,
        type: "completion_high",
        severity: "positive",
        message: `"${assignment.title}" completata. ${completed}/${total} studenti con buoni risultati.`,
      });
    }

    if (feedItems.length > 0) {
      await supabase.from("teacher_activity_feed").insert(feedItems);
    }

    return new Response(JSON.stringify({ success: true, feedItems: feedItems.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
