import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, concept, summary, subject, studentProfile, strength } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const currentStrength = strength || 50;
    const difficultyLevel = currentStrength >= 70 ? "avanzato" : currentStrength >= 40 ? "intermedio" : "base";

    const studentName = studentProfile?.name || "Studente";
    const systemPrompt = `Sei il Coach AI di Inschool. Stai facendo un RIPASSO con ${studentName} su un concetto che ha già studiato.
Rivolgiti SEMPRE direttamente allo studente dandogli del "tu". Non parlare mai in terza persona ("lo studente ha imparato..."), ma dì "hai imparato...", "ricordi...?", "prova a spiegarmi...".

CONCETTO: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO DI RIFERIMENTO: ${summary || "non disponibile"}
LIVELLO ATTUALE DI COMPRENSIONE: ${difficultyLevel} (forza: ${currentStrength}/100)

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentProfile?.age || "non specificata"}
- Stile preferito: ${studentProfile?.supportStyle || "gentile"}

REGOLE:
- Rivolgiti SEMPRE con il "tu" direttamente a ${studentName}
- Fai domande adattive al suo livello
- Se livello "base": domande semplici, definizioni, esempi concreti
- Se livello "intermedio": domande di applicazione, collegamento tra concetti
- Se livello "avanzato": domande di ragionamento, casi particolari, "perché?"
- Sii incoraggiante e socratico
- Risposte brevi (2-3 frasi max)
- Dopo la sua risposta, digli cosa ha detto bene e cosa potrebbe rivedere
- Fai UNA domanda alla volta
- Usa emoji con moderazione
- Alla fine (dopo 2-3 domande) dai un giudizio complessivo

IMPORTANTE: Nell'ULTIMO messaggio (dopo 2-3 scambi), concludi con una riga speciale:
[STRENGTH_UPDATE: XX]
dove XX è il nuovo valore di forza (0-100) basato sulle risposte.
Non mostrare questa riga, la userai internamente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("review-memory error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
