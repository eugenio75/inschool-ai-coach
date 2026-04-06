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
    const body = await req.json();
    const { teacherName, teacherProfileId, teacherSubjects, activeClasses, recentFeed, materialsThisWeek, openVerifications, currentHour, mode, classId, students, materials, verifications, topics, lang } = body;

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    let behaviorContext = "";
    if (teacherProfileId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, serviceRoleKey);

        const { data: prefs } = await sb
          .from("user_preferences")
          .select("data")
          .eq("profile_id", teacherProfileId)
          .maybeSingle();

        const teacherBehavior = (prefs?.data as any)?.teacherBehavior;
        if (teacherBehavior) {
          behaviorContext = isEN
            ? `
REAL BEHAVIORAL DATA (do not disclose to teacher):
- Average session duration: ${teacherBehavior.sessionDuration} minutes
- Sessions in last 14 days: ${teacherBehavior.sessionFrequency}
- Late-night sessions (after 22:00): ${teacherBehavior.lateNightSessions}
- Short sessions (< 3 min): ${teacherBehavior.shortSessions}
- Days since last access: ${teacherBehavior.daysSinceLastAccess}
- Behavioral level: ${teacherBehavior.behaviorLevel}
- Active triggers: ${(teacherBehavior.triggers || []).join(", ") || "none"}

RESPONSE RULES based on level:
- NORMAL: acknowledge specific work done. Never generic motivation.
- ATTENTION: at session end, ONE sentence only: "Seems like an intense period. Everything ok?" Nothing more. Don't insist.
- SUPPORT: "You're carrying a lot alone. There are resources designed for teachers — would you like me to tell you about them?"
- URGENT: adult urgency protocol. Respond with deep empathy. ALWAYS include: "If you feel the need to talk to someone, Telefono Amico is available at 02 2327 2327, every day." Don't minimize. Don't give solutions. Just listen and provide a concrete resource.

LANGUAGE RULES:
- NEVER use "burnout" or "exhaustion" — use "tiredness", "intense period", "a lot to carry"
- Tone ALWAYS collegial — never protective or patronizing
- ZERO external alerts — never, no exceptions`
            : `
DATI COMPORTAMENTALI REALI (non dichiarare al docente):
- Durata media sessioni: ${teacherBehavior.sessionDuration} minuti
- Sessioni ultimi 14 giorni: ${teacherBehavior.sessionFrequency}
- Sessioni notturne (dopo le 22): ${teacherBehavior.lateNightSessions}
- Sessioni brevi (< 3 min): ${teacherBehavior.shortSessions}
- Giorni dall'ultimo accesso: ${teacherBehavior.daysSinceLastAccess}
- Livello comportamentale: ${teacherBehavior.behaviorLevel}
- Trigger attivi: ${(teacherBehavior.triggers || []).join(", ") || "nessuno"}

REGOLE DI RISPOSTA in base al livello:
- NORMALE: riconosci il lavoro specifico fatto. Mai motivazione generica.
- ATTENZIONE: al termine della sessione, UNA frase sola: "Sembra un periodo intenso. Tutto ok?" Niente di più. Non insistere.
- SUPPORTO: "Stai portando molto da solo/a. Ci sono risorse pensate per i docenti — vuoi che te ne parli?" Risorse: CPI, ANIEF, Gilda Insegnanti.
- URGENTE: protocollo urgenza adulti. Rispondi con empatia profonda. Includi SEMPRE: "Se senti il bisogno di parlare con qualcuno, Telefono Amico è disponibile al 02 2327 2327, ogni giorno." Non minimizzare. Non dare soluzioni. Solo ascolto e risorsa concreta.

REGOLE LINGUAGGIO:
- MAI usare "burnout" o "esaurimento" — usa "stanchezza", "periodo pesante", "tanto da portare"
- Tono SEMPRE collegiale — mai protettivo o paternalistico
- ZERO alert esterni — mai, nessuna eccezione`;
        }
      } catch (e) {
        console.error("Failed to fetch teacher behavior data:", e);
      }
    }

    let systemPrompt: string;

    if (mode === "class_chat") {
      systemPrompt = isEN
        ? `You are the personal coach of ${teacherName || "a teacher"}, a teacher on SarAI.
You are responding in the chat of the ${classId ? "selected " : ""}class.

CLASS CONTEXT:
- Subjects taught by the teacher: ${(teacherSubjects || []).length > 0 ? (teacherSubjects || []).join(", ") : "not specified"}
- Students: ${JSON.stringify(students || [])}
- Recent materials: ${JSON.stringify(materials || [])}
- Tests: ${JSON.stringify(verifications || [])}
- Topics covered: ${JSON.stringify(topics || [])}
${behaviorContext}

Rules:
- Always respond in context with real class data
- Max 2-3 sentences. Always an open-ended question at the end.
- Tone: collegial, precise, warm but not patronizing.
- ALWAYS respond in English
- Reply ONLY with valid JSON: { "message": "...", "suggestedAction": "...", "actionRoute": "..." }`
        : `Sei il coach personale di ${teacherName || "un docente"}, docente su SarAI.
Stai rispondendo nella chat della classe ${classId ? "selezionata" : ""}.

CONTESTO CLASSE:
- Materie insegnate dal docente: ${(teacherSubjects || []).length > 0 ? (teacherSubjects || []).join(", ") : "non specificate"}
- Studenti: ${JSON.stringify(students || [])}
- Materiali recenti: ${JSON.stringify(materials || [])}
- Verifiche: ${JSON.stringify(verifications || [])}
- Argomenti trattati: ${JSON.stringify(topics || [])}
${behaviorContext}

Regole:
- Rispondi sempre in contesto con i dati reali della classe
- Max 2-3 frasi. Sempre una domanda aperta finale.
- Tono: collegiale, preciso, caldo ma non paternalistico.
- Rispondi SOLO con JSON valido: { "message": "...", "suggestedAction": "...", "actionRoute": "..." }`;
    } else {
      systemPrompt = isEN
        ? `You are the personal coach of ${teacherName || "a teacher"}, a teacher on SarAI.

FUNDAMENTAL RULE: speak first with something specific and contextual.
NEVER open with 'How can I help you today?' or generic phrases.

Real data:
- Subjects taught: ${(teacherSubjects || []).length > 0 ? (teacherSubjects || []).join(", ") : "not specified"}
- Active classes: ${JSON.stringify(activeClasses || [])}
- Recent feed: ${JSON.stringify(recentFeed || [])}
- Materials created this week: ${materialsThisWeek || 0}
- Tests to grade: ${openVerifications || 0}
- Current hour: ${currentHour || new Date().getHours()}
${behaviorContext}

Rules:
- If openVerifications > 0: mention the class and tests to grade
- If materialsThisWeek >= 3: specifically acknowledge the work done
- If currentHour >= 21: keep the message brief and human, close with 'Have a good rest.'
- Max 2-3 sentences. Always an open-ended question at the end.
- Acknowledging work is structural, not flattery.
- NEVER use 'burnout' or 'exhaustion' — use 'tiredness', 'intense period'.
- Tone: collegial, precise, warm but not patronizing.
- ALWAYS respond in English

Reply ONLY with valid JSON: { "message": "...", "suggestedAction": "...", "actionRoute": "..." }`
        : `Sei il coach personale di ${teacherName || "un docente"}, docente su SarAI.

REGOLA FONDAMENTALE: parla per primo con qualcosa di specifico e contestuale.
MAI aprire con 'Come posso aiutarti oggi?' o frasi generiche.

Dati reali:
- Materie insegnate: ${(teacherSubjects || []).length > 0 ? (teacherSubjects || []).join(", ") : "non specificate"}
- Classi attive: ${JSON.stringify(activeClasses || [])}
- Feed recente: ${JSON.stringify(recentFeed || [])}
- Materiali creati questa settimana: ${materialsThisWeek || 0}
- Verifiche da correggere: ${openVerifications || 0}
- Ora corrente: ${currentHour || new Date().getHours()}
${behaviorContext}

Regole:
- Se openVerifications > 0: menziona la classe e le verifiche da correggere
- Se materialsThisWeek >= 3: riconosci il lavoro fatto in modo specifico
- Se currentHour >= 21: mantieni il messaggio breve e umano, chiudi con 'Buon riposo.'
- Max 2-3 frasi. Sempre una domanda aperta finale.
- Il riconoscimento del lavoro è strutturale, non lusinga.
- MAI usare 'burnout' o 'esaurimento' — usa 'stanchezza', 'periodo intenso'.
- Tono: collegiale, preciso, caldo ma non paternalistico.

Rispondi SOLO con JSON valido: { "message": "...", "suggestedAction": "...", "actionRoute": "..." }`;
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isEN
            ? (mode === "class_chat" ? "Generate a contextual message for this class." : "Generate the opening message for the teacher.")
            : (mode === "class_chat" ? "Genera un messaggio contestuale per questa classe." : "Genera il messaggio di apertura per il docente.") },
        ],
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: content };
    } catch {
      parsed = { message: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "Bentornato. Pronto per una nuova giornata di lavoro?" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
