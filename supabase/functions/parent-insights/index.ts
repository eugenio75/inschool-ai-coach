import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei un esperto di pedagogia e psicologia dell'apprendimento per bambini e ragazzi.
Analizzi i dati di studio di un bambino e fornisci consigli personalizzati ai genitori.

REGOLE:
- Rispondi SEMPRE in italiano
- Fornisci esattamente 4 consigli personalizzati basati sui dati reali del bambino
- Ogni consiglio deve essere pratico e attuabile
- Tono: caldo, non giudicante, incoraggiante
- NON menzionare mai voti o performance scolastica
- Concentrati su: autonomia, benessere emotivo, metodo di studio, motivazione

FORMATO RISPOSTA (JSON array di 4 oggetti):
[
  { "icon": "lightbulb|eye|message|brain|heart|clock|star", "title": "Titolo breve", "text": "Consiglio in 1-2 frasi", "category": "metodo|emotivo|autonomia|motivazione" }
]

Rispondi SOLO con il JSON array, nient'altro.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { childProfile, gamification, sessionsCount, totalMinutes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Analizza questi dati e fornisci 4 consigli personalizzati per i genitori di ${childProfile.name}:

PROFILO:
- Nome: ${childProfile.name}
- Età: ${childProfile.age || "non specificata"}
- Classe: ${childProfile.school_level || "non specificata"}
- Materie preferite: ${childProfile.favorite_subjects?.join(", ") || "non specificate"}
- Materie difficili: ${childProfile.difficult_subjects?.join(", ") || "non specificate"}
- Difficoltà: ${childProfile.struggles?.join(", ") || "nessuna specificata"}
- Stile coach: ${childProfile.support_style || "gentile"}
- Tempo focus preferito: ${childProfile.focus_time || 15} minuti

STATISTICHE:
- Sessioni totali: ${sessionsCount || 0}
- Minuti totali di studio: ${totalMinutes || 0}
- Punti focus: ${gamification?.focus_points || 0}
- Punti autonomia: ${gamification?.autonomy_points || 0}
- Streak attuale: ${gamification?.streak || 0} giorni`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Errore del servizio AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";

    // Parse the JSON from the AI response
    let insights;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      insights = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI insights:", content);
      insights = [];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parent-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
