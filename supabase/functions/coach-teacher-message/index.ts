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
    const { teacherName, teacherProfileId, activeClasses, recentFeed, materialsThisWeek, openVerifications, currentHour } = await req.json();

    // Fetch teacher behavior data from user_preferences if available
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
          behaviorContext = `
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

    const systemPrompt = `Sei il coach personale di ${teacherName || "un docente"}, docente su InSchool.

REGOLA FONDAMENTALE: parla per primo con qualcosa di specifico e contestuale.
MAI aprire con 'Come posso aiutarti oggi?' o frasi generiche.

Dati reali:
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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera il messaggio di apertura per il docente." },
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
