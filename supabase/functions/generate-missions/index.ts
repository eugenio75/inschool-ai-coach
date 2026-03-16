import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mission templates - 2 missions per day, picked based on context
const MISSION_TEMPLATES = [
  {
    type: "study_session",
    title: "Completa una sessione di studio",
    description: "Porta a termine una sessione con il Coach",
    points: 15,
    condition: "always", // always available
  },
  {
    type: "review_concept",
    title: "Ripassa un concetto",
    description: "Fai un ripasso nella sezione Memoria",
    points: 10,
    condition: "has_weak_concepts",
  },
  {
    type: "study_minutes",
    title: "Studia per almeno 10 minuti",
    description: "Accumula 10 minuti di studio oggi",
    points: 15,
    condition: "always",
  },
  {
    type: "complete_task",
    title: "Completa un compito",
    description: "Finisci uno dei tuoi compiti di oggi",
    points: 20,
    condition: "has_tasks",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { childProfileId, accessCode } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let resolvedChildId = childProfileId;

    // Validate access
    if (accessCode) {
      const { data: codeResult } = await supabase.rpc("validate_child_code", { code: accessCode });
      if (!codeResult?.valid) {
        return new Response(JSON.stringify({ error: "Codice non valido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedChildId = codeResult.profile.id;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: "Non autorizzato" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!resolvedChildId) {
      return new Response(JSON.stringify({ missions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if missions already exist for today
    const { data: existing } = await supabase
      .from("daily_missions")
      .select("*")
      .eq("child_profile_id", resolvedChildId)
      .eq("mission_date", today);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ missions: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get context to pick appropriate missions
    const [tasksResult, memoryResult] = await Promise.all([
      supabase.from("homework_tasks").select("id").eq("child_profile_id", resolvedChildId).eq("completed", false),
      supabase.from("memory_items").select("id, strength").eq("child_profile_id", resolvedChildId).lt("strength", 60),
    ]);

    const hasTasks = (tasksResult.data?.length || 0) > 0;
    const hasWeakConcepts = (memoryResult.data?.length || 0) > 0;

    // Filter available missions based on context
    const available = MISSION_TEMPLATES.filter(m => {
      if (m.condition === "always") return true;
      if (m.condition === "has_tasks") return hasTasks;
      if (m.condition === "has_weak_concepts") return hasWeakConcepts;
      return true;
    });

    // Pick 2 missions, prioritizing variety
    const selected: typeof MISSION_TEMPLATES = [];
    const shuffled = [...available].sort(() => Math.random() - 0.5);

    // Always include study_session as one mission
    const studyMission = shuffled.find(m => m.type === "study_session");
    if (studyMission) selected.push(studyMission);

    // Pick second mission (different type)
    for (const m of shuffled) {
      if (selected.length >= 2) break;
      if (!selected.find(s => s.type === m.type)) {
        selected.push(m);
      }
    }

    // Ensure we have exactly 2
    while (selected.length < 2 && shuffled.length > 0) {
      const m = shuffled.pop()!;
      if (!selected.find(s => s.type === m.type)) selected.push(m);
    }

    // Insert missions
    const missions = selected.map(m => ({
      child_profile_id: resolvedChildId,
      mission_date: today,
      mission_type: m.type,
      title: m.title,
      description: m.description,
      points_reward: m.points,
    }));

    const { data: inserted, error } = await supabase
      .from("daily_missions")
      .insert(missions)
      .select();

    if (error) {
      console.error("Insert missions error:", error);
      // If unique constraint violation, missions were created concurrently
      const { data: retry } = await supabase
        .from("daily_missions")
        .select("*")
        .eq("child_profile_id", resolvedChildId)
        .eq("mission_date", today);
      return new Response(JSON.stringify({ missions: retry || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ missions: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-missions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});