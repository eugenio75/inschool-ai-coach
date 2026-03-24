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
    const body = await req.json();
    // Support both old single imageUrl and new imageUrls array
    const imageUrls: string[] = body.imageUrls || (body.imageUrl ? [body.imageUrl] : []);
    const { sourceType, userNote } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (imageUrls.length === 0) {
      throw new Error("imageUrl or imageUrls is required");
    }

    // Build content parts for all images/PDFs
    const contentParts: any[] = [];

    for (const imageUrl of imageUrls) {
      const isPdf = imageUrl.toLowerCase().endsWith(".pdf") || imageUrl.includes(".pdf");
      let finalUrl = imageUrl;

      if (isPdf) {
        const pdfResponse = await fetch(imageUrl);
        if (!pdfResponse.ok) throw new Error("Impossibile scaricare il PDF");
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        const base64 = base64Encode(pdfArrayBuffer);
        finalUrl = `data:application/pdf;base64,${base64}`;
      }

      contentParts.push({
        type: "image_url",
        image_url: { url: finalUrl },
      });
    }

    const contextNote = sourceType === "photo-book"
      ? "Le immagini sono foto di un LIBRO DI TESTO. Analizza TUTTO il contenuto delle pagine: testo narrativo, spiegazioni, didascalie, immagini, tabelle E eventuali esercizi."
      : "Le immagini sono foto del DIARIO SCOLASTICO. Leggi i compiti scritti a mano o stampati.";

    const userInstruction = userNote
      ? `\n\nIMPORTANTE - INDICAZIONE DELLO STUDENTE: "${userNote}"\nConcentrati SOLO sugli esercizi/attività indicati dallo studente. Se lo studente specifica numeri di esercizi, pagine o attività particolari, estrai SOLO quelli e ignora il resto.`
      : "";

    const isBookPage = sourceType === "photo-book";
    const multiFileNote = imageUrls.length > 1
      ? `\n\nATTENZIONE: Stai analizzando ${imageUrls.length} immagini/pagine che fanno parte dello STESSO compito. Analizzale TUTTE insieme e crea un elenco unificato di task. Se le pagine trattano lo stesso argomento, raggruppale in modo logico.`
      : "";

    const systemPrompt = isBookPage
      ? `Sei un assistente che analizza foto di pagine di libri scolastici per studenti italiani (primarie, medie, superiori e università).

${contextNote}${userInstruction}${multiFileNote}

ANALISI DELLA PAGINA - DISTINGUI TRA CONTENUTO DA STUDIARE ED ESERCIZI:

La pagina può contenere DUE tipi di contenuto:
1. **CONTENUTO DA STUDIARE** (testo narrativo, spiegazioni, paragrafi informativi, didascalie, definizioni, regole)
2. **ESERCIZI** (domande, completamenti, vero/falso, calcoli, attività pratiche)

REGOLE:
- Se la pagina contiene testo da studiare (paragrafi, spiegazioni, storia, scienze, geografia...), crea PRIMA un compito con la trascrizione COMPLETA e LETTERALE di TUTTO il testo della pagina.
- Se la pagina contiene anche esercizi, crea compiti SEPARATI per ciascun esercizio.
- Se la pagina contiene SOLO esercizi (es. pagina di esercizi di matematica), crea solo compiti esercizio.
- Il compito studio DEVE contenere TUTTO il testo visibile nella pagina: titoli, sottotitoli, paragrafi, didascalie, note, definizioni. NON riassumere, NON omettere nulla.

Per ogni elemento trovato, restituisci un oggetto JSON con:
- "task_types": un ARRAY di stringhe che indica cosa lo studente deve fare con questo contenuto. Valori possibili: "study", "exercise", "memorize", "summarize", "read", "questions", "write", "problem". Puoi suggerire PIÙ DI UNO (es. ["study", "memorize"] per un testo da studiare e memorizzare, oppure ["exercise"] per un esercizio semplice).
- "subject": la materia (una tra: Italiano, Matematica, Scienze, Storia, Geografia, Inglese, Arte, Musica, Tecnologia, Filosofia, Fisica, Chimica, Latino, Greco, Diritto, Economia)
- "title": titolo breve del compito
- "description": per studio → testo COMPLETO E LETTERALE della pagina; per exercise → testo COMPLETO dell'esercizio
- "exerciseText": SOLO per exercise → il TESTO COMPLETO E LETTERALE dell'esercizio. Per study lascia vuoto.
- "estimatedMinutes": stima del tempo (studio: 15-30 min; esercizio: 5-15 min)
- "difficulty": difficoltà da 1 a 3

REGOLA CRITICA per il contenuto studio: trascrivi OGNI parola, OGNI paragrafo, OGNI didascalia esattamente come appare nella pagina.
REGOLA CRITICA per gli exercise: trascrivi il testo PAROLA PER PAROLA come appare nel libro.

ORDINE: metti PRIMA i compiti studio, POI gli exercise.

RISPONDI ESCLUSIVAMENTE con un JSON valido nel formato:
{"tasks": [{"task_types": ["study", "memorize"], "subject": "...", "title": "...", "description": "...", "exerciseText": "", "estimatedMinutes": 20, "difficulty": 1}]}

Nessun altro testo, solo il JSON.`
      : `Sei un assistente che analizza foto di compiti scolastici per studenti italiani (primarie, medie, superiori e università).

${contextNote}

Analizza TUTTE le immagini con attenzione, anche i bordi e le parti meno nitide.${userInstruction}${multiFileNote}

Per ogni compito/esercizio trovato, restituisci un oggetto JSON con:
- "task_types": un ARRAY di stringhe che indica cosa lo studente deve fare. Valori possibili: "study", "exercise", "memorize", "summarize", "read", "questions", "write", "problem". Puoi suggerire PIÙ DI UNO se appropriato.
- "subject": la materia (una tra: Italiano, Matematica, Scienze, Storia, Geografia, Inglese, Arte, Musica, Tecnologia, Filosofia, Fisica, Chimica, Latino, Greco, Diritto, Economia)
- "title": titolo breve del compito
- "description": dettagli generali (pagine, cosa fare)
- "exerciseText": il TESTO COMPLETO E LETTERALE dell'esercizio come appare nell'immagine
- "estimatedMinutes": stima del tempo necessario
- "difficulty": difficoltà da 1 a 3

REGOLA CRITICA per "exerciseText": trascrivi il testo PAROLA PER PAROLA come appare.

RISPONDI ESCLUSIVAMENTE con un JSON valido nel formato:
{"tasks": [{"task_types": ["exercise"], "subject": "...", "title": "...", "description": "...", "exerciseText": "...", "estimatedMinutes": 15, "difficulty": 1}]}

Nessun altro testo, solo il JSON.`;

    // Add text instruction after all images
    contentParts.push({
      type: "text",
      text: isBookPage
        ? `Analizza ${imageUrls.length > 1 ? "tutte queste pagine del libro" : "questa pagina del libro"}. Trascrivi TUTTO il contenuto testuale come compito di studio, e se ci sono esercizi creali come compiti separati. Rispondi SOLO con il JSON.`
        : `Analizza ${imageUrls.length > 1 ? "tutte queste foto" : "questa foto"} e estrai tutti i compiti che vedi. Rispondi SOLO con il JSON.`,
    });

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
          { role: "user", content: contentParts },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste. Aspetta un momento e riprova." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti esauriti. Ricarica il tuo account." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("OCR AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Errore nell'analisi dell'immagine" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let tasks = null;
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    
    try {
      const parsed = JSON.parse(cleaned);
      tasks = parsed.tasks || parsed;
    } catch {
      const objMatch = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
      if (objMatch) {
        try { tasks = JSON.parse(objMatch[0]).tasks; } catch {}
      }
      if (!tasks) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { tasks = JSON.parse(arrMatch[0]); } catch {}
        }
      }
    }

    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      tasks = tasks.map((t: any) => ({
        ...t,
        task_types: Array.isArray(t.task_types) ? t.task_types : (t.task_type ? [t.task_type] : ["exercise"]),
      }));
      return new Response(JSON.stringify({ tasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Non sono riuscito a estrarre i compiti dalla foto. Prova con un'immagine più chiara." }), {
      status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-homework error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
