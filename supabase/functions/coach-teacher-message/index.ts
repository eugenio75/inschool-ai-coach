import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teacherName, activeClasses, recentFeed, materialsThisWeek, openVerifications, currentHour } = await req.json();

    const systemPrompt = `Sei il coach personale di ${teacherName || "un docente"}, docente su InSchool.

REGOLA FONDAMENTALE: parla per primo con qualcosa di specifico e contestuale.
MAI aprire con 'Come posso aiutarti oggi?' o frasi generiche.

Dati reali:
- Classi attive: ${JSON.stringify(activeClasses || [])}
- Feed recente: ${JSON.stringify(recentFeed || [])}
- Materiali creati questa settimana: ${materialsThisWeek || 0}
- Verifiche da correggere: ${openVerifications || 0}
- Ora corrente: ${currentHour || new Date().getHours()}

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
    const res = await fetch("https://api.lovable.dev/v1/chat/completions", {
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
