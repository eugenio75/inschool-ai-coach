import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, sourceType, userNote } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    // Check if it's a PDF - if so, download and convert to base64 data URL
    const isPdf = imageUrl.toLowerCase().endsWith(".pdf") || imageUrl.includes(".pdf");
    let finalImageUrl = imageUrl;

    if (isPdf) {
      const pdfResponse = await fetch(imageUrl);
      if (!pdfResponse.ok) throw new Error("Impossibile scaricare il PDF");
      const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
      const base64 = base64Encode(pdfBuffer);
      finalImageUrl = `data:application/pdf;base64,${base64}`;
    }

    const contextNote = sourceType === "photo-book"
      ? "L'immagine è una foto di un LIBRO DI TESTO. Analizza TUTTO il contenuto della pagina: testo narrativo, spiegazioni, didascalie, immagini, tabelle E eventuali esercizi."
      : "L'immagine è una foto del DIARIO SCOLASTICO. Leggi i compiti scritti a mano o stampati.";

    const userInstruction = userNote
      ? `\n\nIMPORTANTE - INDICAZIONE DELLO STUDENTE: "${userNote}"\nConcentrati SOLO sugli esercizi/attività indicati dallo studente. Se lo studente specifica numeri di esercizi, pagine o attività particolari, estrai SOLO quelli e ignora il resto.`
      : "";

    // Different prompt based on source type
    const isBookPage = sourceType === "photo-book";

    const systemPrompt = isBookPage
      ? `Sei un assistente che analizza foto di pagine di libri scolastici per bambini delle scuole primarie e medie italiane.

${contextNote}${userInstruction}

ANALISI DELLA PAGINA - DISTINGUI TRA CONTENUTO DA STUDIARE ED ESERCIZI:

La pagina può contenere DUE tipi di contenuto:
1. **CONTENUTO DA STUDIARE** (testo narrativo, spiegazioni, paragrafi informativi, didascalie, definizioni, regole) → task_type: "study"
2. **ESERCIZI** (domande, completamenti, vero/falso, calcoli, attività pratiche) → task_type: "exercise"

REGOLE:
- Se la pagina contiene testo da studiare (paragrafi, spiegazioni, storia, scienze, geografia...), crea PRIMA un compito di tipo "study" con la trascrizione COMPLETA e LETTERALE di TUTTO il testo della pagina.
- Se la pagina contiene anche esercizi, crea compiti SEPARATI di tipo "exercise" per ciascun esercizio.
- Se la pagina contiene SOLO esercizi (es. pagina di esercizi di matematica), crea solo compiti "exercise".
- Il compito "study" DEVE contenere TUTTO il testo visibile nella pagina: titoli, sottotitoli, paragrafi, didascalie, note, definizioni. NON riassumere, NON omettere nulla.

Per ogni elemento trovato, restituisci un oggetto JSON con:
- "task_type": "study" per contenuto da studiare, "exercise" per esercizi
- "subject": la materia (una tra: Italiano, Matematica, Scienze, Storia, Geografia, Inglese, Arte, Musica, Tecnologia)
- "title": per study → "Studia: [titolo argomento/pagina]"; per exercise → titolo breve dell'esercizio (es. "Esercizio 2 - Vero o Falso")
- "description": per study → testo COMPLETO E LETTERALE della pagina; per exercise → testo COMPLETO dell'esercizio
- "exerciseText": SOLO per exercise → il TESTO COMPLETO E LETTERALE dell'esercizio. Per study lascia vuoto.
- "estimatedMinutes": stima del tempo (studio: 15-30 min; esercizio: 5-15 min)
- "difficulty": difficoltà da 1 a 3

REGOLA CRITICA per il contenuto "study": trascrivi OGNI parola, OGNI paragrafo, OGNI didascalia esattamente come appare nella pagina. Il bambino userà questo testo per studiare e ripetere. NON riassumere, NON parafrasare.

REGOLA CRITICA per gli "exercise": trascrivi il testo PAROLA PER PAROLA come appare nel libro. Se non riesci a leggere una parte, scrivi [illeggibile].

ORDINE: metti PRIMA i compiti "study" (nell'ordine in cui appaiono nella pagina), POI gli "exercise".

RISPONDI ESCLUSIVAMENTE con un JSON valido nel formato:
{"tasks": [{"task_type": "study", "subject": "...", "title": "...", "description": "...", "exerciseText": "", "estimatedMinutes": 20, "difficulty": 1}, {"task_type": "exercise", "subject": "...", "title": "...", "description": "...", "exerciseText": "...", "estimatedMinutes": 10, "difficulty": 2}]}

Nessun altro testo, solo il JSON.`
      : `Sei un assistente che analizza foto di compiti scolastici per bambini delle scuole primarie e medie italiane.

${contextNote}

Analizza TUTTA l'immagine con attenzione, anche i bordi e le parti meno nitide.${userInstruction}

Per ogni compito/esercizio trovato, restituisci un oggetto JSON con:
- "task_type": "exercise"
- "subject": la materia (una tra: Italiano, Matematica, Scienze, Storia, Geografia, Inglese, Arte, Musica, Tecnologia)
- "title": titolo breve del compito (es. "Esercizio 2 - Vero o Falso")
- "description": dettagli generali (pagine, cosa fare)
- "exerciseText": il TESTO COMPLETO E LETTERALE dell'esercizio come appare nell'immagine. Trascrivi OGNI parola, OGNI domanda, OGNI opzione esattamente come scritte. NON riassumere, NON parafrasare, NON omettere nulla. Se ci sono sotto-domande (a, b, c...) o affermazioni da valutare, trascrivile TUTTE.
- "estimatedMinutes": stima del tempo necessario (numero intero)
- "difficulty": difficoltà da 1 a 3 (numero intero)

REGOLA CRITICA per "exerciseText": devi trascrivere il testo PAROLA PER PAROLA come appare nel libro/quaderno. Se non riesci a leggere una parte, scrivi [illeggibile]. Non inventare MAI testo che non vedi.

Se non riesci a leggere chiaramente qualcosa, indica [illeggibile] nelle parti non chiare.

RISPONDI ESCLUSIVAMENTE con un JSON valido nel formato:
{"tasks": [{"task_type": "exercise", "subject": "...", "title": "...", "description": "...", "exerciseText": "...", "estimatedMinutes": 15, "difficulty": 1}]}

Nessun altro testo, solo il JSON.`;

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
                image_url: { url: finalImageUrl },
              },
              {
                type: "text",
                text: isBookPage
                  ? "Analizza questa pagina del libro. Trascrivi TUTTO il contenuto testuale come compito di studio, e se ci sono esercizi creali come compiti separati. Rispondi SOLO con il JSON."
                  : "Analizza questa foto e estrai tutti i compiti che vedi. Rispondi SOLO con il JSON.",
              },
            ],
          },
        ],
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
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let tasks = null;
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    
    try {
      const parsed = JSON.parse(cleaned);
      tasks = parsed.tasks || parsed;
    } catch {
      const objMatch = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
      if (objMatch) {
        try {
          const parsed = JSON.parse(objMatch[0]);
          tasks = parsed.tasks;
        } catch {}
      }
      
      if (!tasks) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { tasks = JSON.parse(arrMatch[0]); } catch {}
        }
      }
    }

    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      // Ensure task_type is set
      tasks = tasks.map((t: any) => ({
        ...t,
        task_type: t.task_type || "exercise",
      }));

      return new Response(JSON.stringify({ tasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
