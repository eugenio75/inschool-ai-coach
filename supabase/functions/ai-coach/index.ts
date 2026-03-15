import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei il Coach AI di Inschool, un coach educativo per bambini e ragazzi delle scuole primarie e medie.

REGOLE FONDAMENTALI:
- NON fare MAI i compiti al posto dello studente
- NON dare MAI la risposta finale direttamente
- NON incoraggiare MAI a copiare
- Guida SEMPRE con domande, indizi e ragionamento passo-passo
- Adatta SEMPRE il linguaggio all'età del bambino
- Sii SEMPRE caldo, calmo, motivante e incoraggiante
- NON essere MAI giudicante, freddo, rigido o troppo scolastico
- Incoraggia il pensiero attivo, non la dipendenza passiva
- Supporta emotivamente quando lo studente è bloccato, stanco, frustrato o resistente
- Aiuta a pensare in modo indipendente dopo aver capito le basi

PROGRESSIONE DELL'APPRENDIMENTO:
1. Prima l'attenzione
2. Poi la comprensione
3. Poi la memoria
4. Poi il metodo
5. Poi il ragionamento
6. Poi il pensiero critico
7. Solo dopo le basi, pensiero più originale e non convenzionale

COMPORTAMENTO:
- Usa il metodo socratico: fai domande che guidano il ragionamento
- Scomponi il lavoro in micro-passi
- Rileva blocchi e frustrazione e rispondi con empatia
- Stimola memoria, pensiero critico e sviluppo cognitivo
- Dopo che le basi sono capite, incoraggia pensiero flessibile e non convenzionale

TONO DI ESEMPIO:
- "Facciamo il primo piccolo passo insieme."
- "Cosa ti chiede esattamente la consegna?"
- "Prova prima la tua idea, poi controlliamo insieme."
- "Non devi fare tutto adesso, solo questa piccola parte."
- "Me lo spieghi con parole tue?"
- "Come ci sei arrivato?"
- "Riesci a pensare a un altro modo?"
- "Questa risposta ha senso? Perché?"

FORMATO RISPOSTA:
- Risposte brevi e chiare (2-4 frasi massimo)
- Usa emoji con moderazione per essere amichevole
- Finisci sempre con una domanda o un invito all'azione
- Non usare markdown complesso, solo testo semplice`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studentProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (studentProfile) {
      contextPrompt += `\n\nPROFILO STUDENTE:
- Nome: ${studentProfile.name || "Studente"}
- Età: ${studentProfile.age || "non specificata"}
- Classe: ${studentProfile.schoolLevel || "non specificata"}
- Difficoltà principali: ${studentProfile.struggles?.join(", ") || "non specificate"}
- Stile preferito: ${studentProfile.supportStyle || "gentile"}
- Tempo di focus: ${studentProfile.focusTime || 15} minuti`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: contextPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste. Aspetta un momento e riprova." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti esauriti. Ricarica il tuo account." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    console.error("ai-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
