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
    const { childProfileId, accessCode, lang } = await req.json();

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let resolvedChildId = childProfileId;

    if (accessCode) {
      const { data: codeResult } = await supabase.rpc("validate_child_code", { code: accessCode });
      if (!codeResult?.valid) {
        return new Response(JSON.stringify({ error: isEN ? "Invalid code" : "Codice non valido" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          return new Response(JSON.stringify({ error: isEN ? "Unauthorized" : "Non autorizzato" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const [profileResult, tasksResult, memoryResult] = await Promise.all([
      supabase.from("child_profiles").select("name, age, school_level, support_style, interests").eq("id", resolvedChildId).maybeSingle(),
      supabase.from("homework_tasks").select("id, subject, title").eq("child_profile_id", resolvedChildId).eq("completed", false),
      supabase.from("memory_items").select("id, concept, subject, strength, summary").eq("child_profile_id", resolvedChildId).order("strength", { ascending: true }).limit(10),
    ]);

    const studentName = profileResult.data?.name || (isEN ? "Student" : "Studente");
    const studentInterests = profileResult.data?.interests || [];
    const hasTasks = (tasksResult.data?.length || 0) > 0;
    const weakConcepts = (memoryResult.data || []).filter((m: any) => (m.strength || 0) < 60);
    const hasWeakConcepts = weakConcepts.length > 0;

    const missions: any[] = [];

    if (hasWeakConcepts) {
      const weakest = weakConcepts[0];
      missions.push({
        child_profile_id: resolvedChildId,
        mission_date: today,
        mission_type: "review_weak_concept",
        title: isEN ? `Review "${weakest.concept}"` : `Ripassa "${weakest.concept}"`,
        description: isEN
          ? `${studentName}, the Coach noticed you could review ${weakest.concept} (${weakest.subject}). Go to the Memory section!`
          : `${studentName}, il Coach ha notato che potresti ripassare ${weakest.concept} (${weakest.subject}). Vai nella sezione Memoria!`,
        points_reward: 15,
        metadata: { concept_id: weakest.id, concept: weakest.concept, subject: weakest.subject },
      });
    } else if (hasTasks) {
      missions.push({
        child_profile_id: resolvedChildId,
        mission_date: today,
        mission_type: "complete_task",
        title: isEN ? "Complete a task" : "Completa un compito",
        description: isEN
          ? `${studentName}, try to finish one of your tasks today!`
          : `${studentName}, prova a finire uno dei tuoi compiti di oggi!`,
        points_reward: 20,
      });
    } else {
      missions.push({
        child_profile_id: resolvedChildId,
        mission_date: today,
        mission_type: "study_session",
        title: isEN ? "Do a study session" : "Fai una sessione di studio",
        description: isEN
          ? `${studentName}, complete a session with the Coach!`
          : `${studentName}, porta a termine una sessione con il Coach!`,
        points_reward: 15,
      });
    }

    let aiMission: any = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY && (hasWeakConcepts || hasTasks)) {
      try {
        const conceptsList = weakConcepts.slice(0, 5).map((c: any) =>
          `- "${c.concept}" (${c.subject}, ${isEN ? "strength" : "forza"}: ${c.strength}/100)${c.summary ? `: ${c.summary}` : ""}`
        ).join("\n");

        const tasksList = (tasksResult.data || []).slice(0, 5).map((t: any) =>
          `- "${t.title}" (${t.subject})`
        ).join("\n");

        const todayInterest = studentInterests.length > 0
          ? studentInterests[Math.floor(Math.random() * studentInterests.length)]
          : null;

        const aiPrompt = isEN
          ? `You are InSchool's AI Coach. Generate ONE personalized daily mission for ${studentName} (${profileResult.data?.age || ""} years old, ${profileResult.data?.school_level || ""}).
${todayInterest ? `\nTODAY'S INTEREST: ${todayInterest}\nUse ONLY this interest as the thread for the challenge. Don't mix multiple interests — the narrative should be coherent around ONE theme.\n` : ""}
CONCEPTS WITH GAPS:
${conceptsList || "None"}

ACTIVE TASKS:
${tasksList || "None"}

GOAL: Create a NARRATIVE CHALLENGE that creatively mixes the student's tasks and/or weak concepts into a single engaging experience.${todayInterest ? ` Use "${todayInterest}" as the story setting.` : ""}

RULES:
- The title must be CATCHY and narrative (like a mini-game title), max 8 words
- The description must be a motivating sentence that previews the adventure, addressed to ${studentName} by name
- MIX at least 2 subjects/concepts when possible
- Must be doable in 5-10 minutes of chat with the Coach
- The type is "coach_challenge" — the student will complete it by chatting with the Coach
- Must NOT be generic or boring
- ALL content must be in English

Reply ONLY with JSON:
{
  "title": "catchy narrative title",
  "description": "adventurous 1-2 sentence description addressed to ${studentName}",
  "subject": "subjects involved (e.g. 'Italian and Mathematics')",
  "concept": "connected concepts if present"
}`
          : `Sei il coach di Inschool. Genera UNA missione del giorno personalizzata per ${studentName} (${profileResult.data?.age || ""} anni, ${profileResult.data?.school_level || ""}).
${todayInterest ? `\nINTERESSE DEL GIORNO: ${todayInterest}\nUsa SOLO questo interesse come filo conduttore della sfida. Non mescolare più interessi insieme — la narrazione deve essere coerente e ruotare attorno a UN SOLO tema.\n` : ""}
CONCETTI CON LACUNE:
${conceptsList || "Nessuno"}

COMPITI ATTIVI:
${tasksList || "Nessuno"}

OBIETTIVO: Creare una SFIDA NARRATIVA che mescoli creativamente i compiti e/o i concetti deboli dello studente in un'unica esperienza coinvolgente.${todayInterest ? ` Usa "${todayInterest}" come ambientazione della storia.` : ""}

REGOLE:
- Il titolo deve essere ACCATTIVANTE e narrativo (come il titolo di un mini-gioco), max 8 parole
- La descrizione deve essere una frase motivante che anticipa l'avventura, rivolta a ${studentName} per nome
- MESCOLA almeno 2 materie/concetti quando possibile
- Deve essere fattibile in 5-10 minuti di chat col Coach
- Il tipo è "coach_challenge" — lo studente la completerà chattando con il Coach
- NON deve essere generica o noiosa

Rispondi SOLO con un JSON:
{
  "title": "titolo narrativo accattivante",
  "description": "descrizione avventurosa di 1-2 frasi rivolta a ${studentName}",
  "subject": "materie coinvolte (es. 'Italiano e Matematica')",
  "concept": "concetti collegati se presenti"
}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: aiPrompt }],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          let rawText = aiData.choices?.[0]?.message?.content || "";
          rawText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

          try {
            const parsed = JSON.parse(rawText);
            aiMission = {
              child_profile_id: resolvedChildId,
              mission_date: today,
              mission_type: "coach_challenge",
              title: parsed.title || (isEN ? "Coach Challenge" : "Sfida del Coach"),
              description: parsed.description || (isEN ? `${studentName}, the Coach has a challenge for you!` : `${studentName}, il Coach ha una sfida per te!`),
              points_reward: 20,
              metadata: {
                subject: parsed.subject || null,
                concept: parsed.concept || null,
                ai_generated: true,
              },
            };
          } catch {
            console.error("Failed to parse AI mission");
          }
        }
      } catch (err) {
        console.error("AI mission generation error:", err);
      }
    }

    if (aiMission) {
      missions.push(aiMission);
    } else {
      missions.push({
        child_profile_id: resolvedChildId,
        mission_date: today,
        mission_type: "study_session",
        title: isEN ? "Complete a study session" : "Completa una sessione di studio",
        description: isEN
          ? `${studentName}, complete a session with the Coach!`
          : `${studentName}, porta a termine una sessione con il Coach!`,
        points_reward: 15,
      });
    }

    const { data: inserted, error } = await supabase
      .from("daily_missions")
      .insert(missions)
      .select();

    if (error) {
      console.error("Insert missions error:", error);
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
