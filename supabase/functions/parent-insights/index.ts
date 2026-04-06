import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSystemPrompt(schoolLevel: string): string {
  const baseRules = `Sei un esperto di pedagogia e psicologia dell'apprendimento.
Analizzi i dati DETTAGLIATI e REALI di studio di uno studente e fornisci consigli personalizzati.

REGOLE FONDAMENTALI:
- Rispondi SEMPRE in italiano
- Ogni consiglio DEVE citare dati concreti: nomi di concetti studiati, materie, emozioni registrate, missioni completate, pattern specifici
- NON usare le materie preferite/difficili dichiarate dal profilo come base per i consigli
- PERÒ, se ci sono materie dichiarate come "difficili" o "non piacevoli", dedica UNO dei 4 consigli a strategie per renderle più attraenti
- NON inventare mai informazioni che non sono nei dati
- Se i dati sono pochi, riconosci questo fatto e dai consigli su come costruire un'abitudine di studio regolare
- NON menzionare mai voti o performance scolastica
- NON fare classifiche o confronti con altri studenti
- Linguaggio sempre costruttivo, mai punitivo

DATI SPECIALI DA ANALIZZARE:
- SESSIONI ESTESE: se lo studente ha studiato più del tempo previsto, evidenzialo come segnale positivo
- MISSIONI E SFIDE: commenta le sfide del coach completate
- PATTERN EMOTIVI: se noti emozioni ricorrenti, suggerisci adattamenti concreti
- PROGRESSIONE MEMORIA: confronta concetti forti vs deboli per suggerire strategie di consolidamento

REGOLE DI CATEGORIZZAZIONE (rispettale rigorosamente):
- "metodo": SOLO strategie cognitive e tecniche di studio (es. come affrontare un esercizio, organizzare gli appunti, ripasso attivo). NON include energia, stanchezza o emozioni.
- "emotivo": TUTTO ciò che riguarda emozioni, energia, stanchezza, umore, stress, pattern emotivi ricorrenti, gestione dell'energia. Se un consiglio menziona "tired", "ready", "stanco", "energia", "umore" → è SEMPRE "emotivo".
- "autonomia": capacità di lavorare in modo indipendente, gestione del tempo, iniziativa.
- "motivazione": impegno, costanza, streak, celebrazione dei progressi.

OGNI CONSIGLIO DEVE APPARIRE IN UNA SOLA CATEGORIA. Non duplicare lo stesso tema in categorie diverse.

FORMATO RISPOSTA (JSON array di 4 oggetti):
[
  { "icon": "lightbulb|eye|message|brain|heart|clock|star", "title": "Titolo breve e specifico", "text": "Consiglio in 2-3 frasi con riferimenti SPECIFICI ai dati reali", "category": "metodo|emotivo|autonomia|motivazione" }
]

Rispondi SOLO con il JSON array, nient'altro.`;

  switch (schoolLevel) {
    case "medie":
      return `${baseRules}

PROFILO STUDENTE: Scuola Media (11-13 anni)
TONO: Caldo, diretto e incoraggiante. Parla come un mentore amichevole.
LINGUAGGIO: Semplice, nessun termine tecnico. Frasi chiare e brevi.
FOCUS: Massimo 2 aree da rinforzare. Non elencare tutti i problemi.
APPROCCIO: Celebra i successi prima di suggerire miglioramenti. Usa un linguaggio tipo "Stai andando bene in..." prima di "Potresti provare a...".
NON usare percentuali, metriche tecniche o termini come "autonomia cognitiva", "bloom", "metacognizione".
Esempio di tono: "Questa settimana hai fatto un ottimo lavoro in matematica. Storia ha bisogno di un po' più di attenzione — il coach ti può aiutare!"`;

    case "superiori":
      return `${baseRules}

PROFILO STUDENTE: Scuola Superiore (14-18 anni)
TONO: Diretto e orientato al metodo. Rispetta l'autonomia dello studente.
LINGUAGGIO: Preciso, usa termini disciplinari quando appropriato.
FOCUS: Errori ricorrenti con suggerimento concreto su come affrontarli. Progressi di autonomia visibili.
APPROCCIO: Vai al punto. Suggerisci strategie pratiche di studio. Collega gli errori a strategie specifiche.
Esempio di tono: "In italiano fai spesso errori di comprensione della consegna — prova a sottolineare i verbi chiave prima di rispondere."`;

    case "universitario":
      return `${baseRules}

PROFILO STUDENTE: Università
TONO: Sobrio ed essenziale. Nessun incoraggiamento infantile. Dialogo alla pari tra colleghi.
LINGUAGGIO: Accademico e preciso. Usa terminologia specifica quando pertinente.
FOCUS: Feedback metacognitivo — come lo studente sta imparando, cosa funziona, cosa ottimizzare. Efficienza delle sessioni. Strategie per ottimizzare il tempo per ogni esame.
APPROCCIO: Analisi strategica. Identifica pattern di apprendimento efficaci e inefficaci. Suggerisci ottimizzazioni basate sui dati.
Esempio di tono: "Con gli esempi concreti capisci meglio la teoria. Cerca sempre un caso applicativo prima di memorizzare il concetto."`;

    default:
      return `${baseRules}

TONO: Caldo, non giudicante, incoraggiante, pratico.
Concentrati su: autonomia, benessere emotivo, metodo di studio, motivazione.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { childProfile, gamification, sessionsCount, totalMinutes, recentSessions, allConcepts, subjectStats, missionsData, emotionPatterns, extendedSessionsCount, schoolLevel } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const effectiveSchoolLevel = schoolLevel || childProfile?.school_level || "superiori";

    // Build detailed sessions section
    let sessionsDetail = "Nessuna sessione recente.";
    if (recentSessions && recentSessions.length > 0) {
      sessionsDetail = recentSessions.map((s: any, i: number) => {
        let line = `${i + 1}. Materia: ${s.subject} | Compito: "${s.task_title || "N/A"}" | Durata: ${s.actual_minutes || Math.round((s.duration_seconds || 0) / 60)}min (previsti: ${s.expected_minutes || "N/A"}min) | Emozione: ${s.emotion || "non registrata"} | Data: ${s.completed_at?.split("T")[0] || "N/A"}`;
        if (s.studied_extra) line += " ⭐ HA STUDIATO PIÙ DEL PREVISTO!";
        return line;
      }).join("\n");
    }

    // Build concepts section
    let conceptsDetail = "Nessun concetto in memoria.";
    if (allConcepts && allConcepts.length > 0) {
      const weak = allConcepts.filter((c: any) => c.is_weak);
      const strong = allConcepts.filter((c: any) => c.is_strong);
      const medium = allConcepts.filter((c: any) => !c.is_weak && !c.is_strong);

      conceptsDetail = "";
      if (strong.length > 0) {
        conceptsDetail += "CONCETTI BEN ACQUISITI (forza ≥ 80):\n" + strong.map((c: any) =>
          `  ✅ ${c.concept} (${c.subject}) — forza: ${c.strength}/100${c.summary ? ` — ${c.summary}` : ""}`
        ).join("\n") + "\n\n";
      }
      if (medium.length > 0) {
        conceptsDetail += "CONCETTI IN CONSOLIDAMENTO (forza 60-79):\n" + medium.map((c: any) =>
          `  🔄 ${c.concept} (${c.subject}) — forza: ${c.strength}/100${c.summary ? ` — ${c.summary}` : ""}`
        ).join("\n") + "\n\n";
      }
      if (weak.length > 0) {
        conceptsDetail += "CONCETTI DA RAFFORZARE (forza < 60):\n" + weak.map((c: any) =>
          `  ⚠️ ${c.concept} (${c.subject}) — forza: ${c.strength}/100${c.summary ? ` — ${c.summary}` : ""}`
        ).join("\n");
      }
      if (!conceptsDetail) conceptsDetail = "Nessun concetto in memoria.";
    }

    // Build subject stats section
    let subjectDetail = "Nessuna statistica per materia.";
    if (subjectStats && Object.keys(subjectStats).length > 0) {
      subjectDetail = Object.entries(subjectStats).map(([subject, stats]: [string, any]) =>
        `- ${subject}: ${stats.sessions} sessioni, ${stats.totalMinutes}min totali, ${stats.completed}/${stats.total} compiti completati`
      ).join("\n");
    }

    // Build missions section
    let missionsDetail = "Nessuna missione registrata.";
    if (missionsData && missionsData.total > 0) {
      missionsDetail = `Missioni totali: ${missionsData.total} | Completate: ${missionsData.completed} | Sfide Coach completate: ${missionsData.challengesCompleted}`;
      if (missionsData.types && missionsData.types.length > 0) {
        missionsDetail += "\nDettaglio:\n" + missionsData.types.map((m: any) =>
          `  ${m.completed ? "✅" : "❌"} ${m.title} (${m.type}) — ${m.date}`
        ).join("\n");
      }
    }

    // Build emotion patterns section
    let emotionDetail = "Nessun pattern emotivo rilevato.";
    if (emotionPatterns && Object.keys(emotionPatterns).length > 0) {
      emotionDetail = Object.entries(emotionPatterns).map(([emotion, count]) =>
        `- ${emotion}: ${count} volte`
      ).join("\n");
    }

    const audienceLabel = effectiveSchoolLevel === "medie" ? "lo studente (11-13 anni)"
      : effectiveSchoolLevel === "universitario" ? "lo studente universitario"
      : effectiveSchoolLevel === "superiori" ? "lo studente delle superiori"
      : "il genitore";

    const userPrompt = `Analizza questi dati DETTAGLIATI e REALI e fornisci 4 consigli iper-personalizzati per ${audienceLabel} di nome ${childProfile.name}:

PROFILO (solo per contesto):
- Nome: ${childProfile.name}
- Età: ${childProfile.age || "non specificata"}
- Livello scolastico: ${effectiveSchoolLevel}
- Tempo focus preferito: ${childProfile.focus_time || 15} minuti

MATERIE DIFFICILI (usa per suggerire strategie creative):
- ${childProfile.difficult_subjects?.join(", ") || "nessuna indicata"}
- Difficoltà segnalate: ${childProfile.struggles?.join(", ") || "nessuna"}

STATISTICHE GENERALI:
- Sessioni totali: ${sessionsCount || 0}
- Minuti totali di studio: ${totalMinutes || 0}
- Sessioni in cui ha studiato PIÙ del previsto: ${extendedSessionsCount || 0}
- Punti impegno: ${gamification?.focus_points || 0}
- Punti autonomia: ${gamification?.autonomy_points || 0}
- Punti costanza: ${gamification?.consistency_points || 0}
- Streak attuale: ${gamification?.streak || 0} giorni consecutivi

ULTIME SESSIONI DI STUDIO (dettaglio):
${sessionsDetail}

MAPPA DELLA MEMORIA:
${conceptsDetail}

MISSIONI E SFIDE DEL COACH:
${missionsDetail}

PATTERN EMOTIVI:
${emotionDetail}

STATISTICHE PER MATERIA:
${subjectDetail}

IMPORTANTE: Basa i consigli sui DATI REALI di studio, NON sulle preferenze dichiarate. Adatta il tono al livello scolastico: ${effectiveSchoolLevel}.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: getSystemPrompt(effectiveSchoolLevel) },
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
