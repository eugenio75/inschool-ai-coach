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
    const { messages, concept, summary, subject, studentProfile, strength, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const currentStrength = strength || 50;
    const difficultyLevel = currentStrength >= 70 ? "avanzato" : currentStrength >= 40 ? "intermedio" : "base";

    const studentName = studentProfile?.name || "Studente";
    const studentInterests = studentProfile?.interests || [];

    let systemPrompt: string;

    if (mode === "deep-summary") {
      systemPrompt = `Sei il Coach AI di Inschool. Devi generare una SINTESI CHIARA E COMPLETA di un argomento studiato da ${studentName}.

ARGOMENTO: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO BREVE DI PARTENZA: ${summary || "non disponibile"}

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentProfile?.age || "non specificata"}
- Livello scolastico: ${studentProfile?.school_level || "non specificato"}

ISTRUZIONI:
- Scrivi una sintesi completa ma accessibile dell'argomento
- Usa un linguaggio adatto all'età e al livello dello studente
- Organizza il contenuto in modo chiaro con punti chiave
- Includi le definizioni importanti
- Aggiungi 1-2 esempi pratici per rendere tutto più concreto
- Se possibile, fai un breve collegamento con altri concetti correlati
- La sintesi deve servire come ripasso veloce ma efficace
- NON fare domande, questa è solo una sintesi da leggere
- Scrivi in modo diretto e chiaro, come se stessi spiegando a ${studentName}
- Usa emoji con moderazione per rendere il testo più leggibile
- Lunghezza: 150-300 parole circa`;
    } else {
      systemPrompt = `Sei il Coach AI di Inschool. Stai facendo un RIPASSO con ${studentName} su un concetto che ha già studiato.
Rivolgiti SEMPRE a ${studentName} usando il suo nome. Non parlare mai in terza persona ("lo studente ha imparato..."), ma dì "${studentName}, ricordi...?", "${studentName}, prova a spiegarmi...".

CONCETTO: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO DI RIFERIMENTO: ${summary || "non disponibile"}
LIVELLO ATTUALE DI COMPRENSIONE: ${difficultyLevel} (forza: ${currentStrength}/100)

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentProfile?.age || "non specificata"}
- Stile preferito: ${studentProfile?.supportStyle || "gentile"}
${studentInterests.length > 0 ? `- Interessi: ${studentInterests.join(", ")}\n\nUsa i suoi interessi (${studentInterests.join(", ")}) per creare esempi e analogie più coinvolgenti durante il ripasso. Questo lo aiuterà a memorizzare meglio!` : ""}

REGOLE:
- Rivolgiti SEMPRE a ${studentName} chiamandolo per nome
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
    }

    const aiMessages = mode === "deep-summary"
      ? [{ role: "system", content: systemPrompt }, { role: "user", content: `Genera una sintesi completa e chiara dell'argomento "${concept}" in ${subject || "questa materia"}.` }]
      : [{ role: "system", content: systemPrompt }, ...messages];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
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
