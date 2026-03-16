import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, accessCode, childProfileId, payload } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate access code on login
    if (action === "login") {
      const { data, error } = await supabase.rpc("validate_child_code", { code: accessCode });
      if (error) throw error;
      if (!data?.valid) {
        return new Response(JSON.stringify({ error: "Codice non valido. Controlla e riprova!" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Also fetch tasks and gamification for initial load
      const profileId = data.profile.id;
      const [tasksResult, gamResult] = await Promise.all([
        supabase.from("homework_tasks").select("*").eq("child_profile_id", profileId).order("created_at", { ascending: false }),
        supabase.from("gamification").select("*").eq("child_profile_id", profileId).maybeSingle(),
      ]);

      return new Response(JSON.stringify({
        profile: data.profile,
        tasks: tasksResult.data || [],
        gamification: gamResult.data,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For all other actions, validate the access code
    if (!accessCode || !childProfileId) {
      return new Response(JSON.stringify({ error: "Accesso non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify code matches profile
    const { data: profile } = await supabase
      .from("child_profiles")
      .select("id, access_code")
      .eq("id", childProfileId)
      .eq("access_code", accessCode.toUpperCase().trim())
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = null;

    switch (action) {
      case "get-tasks": {
        const { data } = await supabase
          .from("homework_tasks")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .order("created_at", { ascending: false });
        result = data || [];
        break;
      }

      case "get-task": {
        const { data } = await supabase
          .from("homework_tasks")
          .select("*")
          .eq("id", payload.taskId)
          .eq("child_profile_id", childProfileId)
          .single();
        result = data;
        break;
      }

      case "get-gamification": {
        const { data } = await supabase
          .from("gamification")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .maybeSingle();
        result = data;
        break;
      }

      case "save-focus-session": {
        const { data, error } = await supabase
          .from("focus_sessions")
          .insert({ child_profile_id: childProfileId, ...payload })
          .select()
          .single();
        if (error) throw error;

        // Update gamification
        const { data: gam } = await supabase
          .from("gamification")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .maybeSingle();

        if (gam) {
          const today = new Date().toISOString().split("T")[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          let newStreak = gam.streak || 0;
          if (gam.last_activity_date === yesterday) newStreak += 1;
          else if (gam.last_activity_date !== today) newStreak = 1;

          await supabase.from("gamification").update({
            focus_points: (gam.focus_points || 0) + (payload.focus_points || 0),
            autonomy_points: (gam.autonomy_points || 0) + (payload.autonomy_points || 0),
            consistency_points: (gam.consistency_points || 0) + (payload.consistency_points || 0),
            streak: newStreak,
            last_activity_date: today,
            updated_at: new Date().toISOString(),
          }).eq("child_profile_id", childProfileId);
        }
        result = data;
        break;
      }

      case "get-memory-items": {
        const { data } = await supabase
          .from("memory_items")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .order("strength", { ascending: true });
        result = data || [];
        break;
      }

      case "update-memory-strength": {
        await supabase.from("memory_items").update({
          strength: payload.strength,
          last_reviewed: new Date().toISOString(),
        }).eq("id", payload.itemId).eq("child_profile_id", childProfileId);
        result = { success: true };
        break;
      }

      case "update-task": {
        const { data } = await supabase
          .from("homework_tasks")
          .update({ ...payload.updates, updated_at: new Date().toISOString() })
          .eq("id", payload.taskId)
          .eq("child_profile_id", childProfileId)
          .select()
          .single();
        result = data;
        break;
      }

      case "create-task": {
        const { data, error } = await supabase
          .from("homework_tasks")
          .insert({ child_profile_id: childProfileId, ...payload })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "get-focus-sessions": {
        const { data } = await supabase
          .from("focus_sessions")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .order("completed_at", { ascending: false });
        result = data || [];
        break;
      }

      case "get-daily-missions": {
        const today = new Date().toISOString().split("T")[0];
        // Try to get existing missions
        let { data: missions } = await supabase
          .from("daily_missions")
          .select("*")
          .eq("child_profile_id", childProfileId)
          .eq("mission_date", today);

        if (!missions || missions.length === 0) {
          // Generate missions by calling the generate-missions function logic inline
          const [tasksRes, memRes] = await Promise.all([
            supabase.from("homework_tasks").select("id").eq("child_profile_id", childProfileId).eq("completed", false),
            supabase.from("memory_items").select("id, strength").eq("child_profile_id", childProfileId).lt("strength", 60),
          ]);
          const hasTasks = (tasksRes.data?.length || 0) > 0;
          const hasWeak = (memRes.data?.length || 0) > 0;

          const templates = [
            { type: "study_session", title: "Completa una sessione di studio", description: "Porta a termine una sessione con il Coach", points: 15 },
            ...(hasWeak ? [{ type: "review_concept", title: "Ripassa un concetto", description: "Fai un ripasso nella sezione Memoria", points: 10 }] : []),
            { type: "study_minutes", title: "Studia per almeno 10 minuti", description: "Accumula 10 minuti di studio oggi", points: 15 },
            ...(hasTasks ? [{ type: "complete_task", title: "Completa un compito", description: "Finisci uno dei tuoi compiti di oggi", points: 20 }] : []),
          ];

          const shuffled = templates.sort(() => Math.random() - 0.5);
          const selected = [shuffled[0]];
          for (const t of shuffled) {
            if (selected.length >= 2) break;
            if (!selected.find(s => s.type === t.type)) selected.push(t);
          }

          const toInsert = selected.map(m => ({
            child_profile_id: childProfileId,
            mission_date: today,
            mission_type: m.type,
            title: m.title,
            description: m.description,
            points_reward: m.points,
          }));

          const { data: inserted } = await supabase.from("daily_missions").insert(toInsert).select();
          missions = inserted || [];
        }
        result = missions;
        break;
      }

      case "complete-mission": {
        await supabase.from("daily_missions").update({
          completed: true,
          completed_at: new Date().toISOString(),
        }).eq("id", payload.missionId).eq("child_profile_id", childProfileId);

        // Add points to gamification
        const { data: gam2 } = await supabase.from("gamification").select("*").eq("child_profile_id", childProfileId).maybeSingle();
        if (gam2) {
          await supabase.from("gamification").update({
            focus_points: (gam2.focus_points || 0) + (payload.pointsReward || 0),
            updated_at: new Date().toISOString(),
          }).eq("child_profile_id", childProfileId);
        }
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Azione non supportata" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("child-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
