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
    const { imageUrl, sourceType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    const systemPrompt = `Sei un assistente che analizza foto di compiti scolastici per bambini delle scuole primarie e medie italiane.

ANALISI IMMAGINE:
Devi estrarre i compiti visibili nell'immagine e restituirli in formato strutturato.

Per ogni compito trovato, estrai:
- subject: la materia (Italiano, Matematica, Scienze, Storia, Geografia, Inglese, Arte, Musica, Tecnologia)
- title: titolo breve del compito
- description: dettagli (pagine, esercizi, cosa fare)
- estimatedMinutes: stima del tempo necessario (numero intero)
- difficulty: difficoltà da 1 a 3

${sourceType === "photo-book" 
  ? "L'immagine è una foto di un LIBRO DI TESTO. Identifica gli esercizi, le domande o le attività visibili."
  : "L'immagine è una foto del DIARIO SCOLASTICO. Leggi i compiti scritti a mano o stampati."}

IMPORTANTE: Se non riesci a leggere chiaramente qualcosa, indica comunque ciò che vedi con [illeggibile] nelle parti non chiare.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: "Analizza questa foto e estrai tutti i compiti che vedi. Rispondi SOLO con un array JSON valido di oggetti, senza altro testo.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_homework",
              description: "Extract homework tasks from an image of a school diary or textbook",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subject: { type: "string", enum: ["Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte", "Musica", "Tecnologia"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        estimatedMinutes: { type: "number" },
                        difficulty: { type: "number", enum: [1, 2, 3] },
                      },
                      required: ["subject", "title", "description", "estimatedMinutes", "difficulty"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_homework" } },
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
      console.error("OCR AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Errore nell'analisi dell'immagine" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ tasks: parsed.tasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tasks = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({ tasks }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {}

    return new Response(JSON.stringify({ error: "Non sono riuscito a estrarre i compiti dalla foto. Prova con un'immagine più chiara." }), {
      status: 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-homework error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
