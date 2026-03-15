import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei un esperto di pedagogia e psicologia dell'apprendimento per bambini e ragazzi.
Analizzi i dati DETTAGLIATI di studio di un bambino e fornisci consigli personalizzati ai genitori.

REGOLE:
- Rispondi SEMPRE in italiano
- Fornisci esattamente 4 consigli personalizzati basati sui dati REALI e SPECIFICI del bambino
- Ogni consiglio DEVE riferirsi a dati concreti che hai ricevuto (materie specifiche, concetti deboli, emozioni, pattern)
- Tono: caldo, non giudicante, incoraggiante
- NON menzionare mai voti o performance scolastica
- Concentrati su: autonomia, benessere emotivo, metodo di studio, motivazione
- Se ci sono concetti deboli in memoria, suggerisci strategie concrete per rafforzarli
- Se noti pattern emotivi (es. sempre stanco), suggerisci adattamenti

FORMATO RISPOSTA (JSON array di 4 oggetti):
[
  { "icon": "lightbulb|eye|message|brain|heart|clock|star", "title": "Titolo breve", "text": "Consiglio in 1-2 frasi con riferimenti specifici ai dati", "category": "metodo|emotivo|autonomia|motivazione" }
]

Rispondi SOLO con il JSON array, nient'altro.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { childProfile, gamification, sessionsCount, totalMinutes, recentSessions, weakConcepts, subjectStats } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build detailed sessions section
    let sessionsDetail = "Nessuna sessione recente.";
    if (recentSessions && recentSessions.length > 0) {
      sessionsDetail = recentSessions.map((s: any, i: number) => 
        `${i + 1}. Materia: ${s.subject || "N/A"} | Durata: ${Math.round((s.duration_seconds || 0) / 60)}min | Emozione: ${s.emotion || "non registrata"} | Data: ${s.completed_at?.split("T")[0] || "N/A"}`
      ).join("\n");
    }

    // Build weak concepts section
    let conceptsDetail = "Nessun concetto in memoria.";
    if (weakConcepts && weakConcepts.length > 0) {
      conceptsDetail = weakConcepts.map((c: any) => 
        `- ${c.concept} (${c.subject}) — forza memoria: ${c.strength}/100${c.summary ? ` — ${c.summary}` : ""}`
      ).join("\n");
    }

    // Build subject stats section
    let subjectDetail = "Nessuna statistica per materia.";
    if (subjectStats && Object.keys(subjectStats).length > 0) {
      subjectDetail = Object.entries(subjectStats).map(([subject, stats]: [string, any]) =>
        `- ${subject}: ${stats.sessions} sessioni, ${stats.totalMinutes}min totali, ${stats.completed}/${stats.total} compiti completati`
      ).join("\n");
    }

    const userPrompt = `Analizza questi dati DETTAGLIATI e fornisci 4 consigli personalizzati per i genitori di ${childProfile.name}:

PROFILO:
- Nome: ${childProfile.name}
- Età: ${childProfile.age || "non specificata"}
- Classe: ${childProfile.school_level || "non specificata"}
- Materie preferite: ${childProfile.favorite_subjects?.join(", ") || "non specificate"}
- Materie difficili: ${childProfile.difficult_subjects?.join(", ") || "non specificate"}
- Difficoltà: ${childProfile.struggles?.join(", ") || "nessuna specificata"}
- Stile coach: ${childProfile.support_style || "gentile"}
- Tempo focus preferito: ${childProfile.focus_time || 15} minuti

STATISTICHE GENERALI:
- Sessioni totali: ${sessionsCount || 0}
- Minuti totali di studio: ${totalMinutes || 0}
- Punti focus: ${gamification?.focus_points || 0}
- Punti autonomia: ${gamification?.autonomy_points || 0}
- Streak attuale: ${gamification?.streak || 0} giorni

ULTIME SESSIONI (dettaglio):
${sessionsDetail}

CONCETTI DEBOLI IN MEMORIA (forza < 60):
${conceptsDetail}

STATISTICHE PER MATERIA:
${subjectDetail}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    let insights;
    try {
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
