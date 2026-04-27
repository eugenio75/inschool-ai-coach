import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(error: string, details: string, step: string, status = 500) {
  return new Response(JSON.stringify({ error, details, step }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const step = { current: "parsing_request" };

  try {
    // --- 1. Parse request ---
    const body = await req.json();
    const { files, sourceType, userNote } = body as {
      files: { base64: string; mimeType: string; name: string }[];
      sourceType?: string;
      userNote?: string;
    };

    if (!Array.isArray(files) || files.length === 0) {
      return errorResponse("no_files", "Nessun file ricevuto", step.current, 400);
    }

    console.log(`[parse-homework-upload] Ricevuti ${files.length} file, sourceType=${sourceType || "unknown"}`);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const sizeKB = Math.round((f.base64.length * 3) / 4 / 1024);
      console.log(`  file[${i}]: ${f.name} | ${f.mimeType} | ~${sizeKB}KB`);
      if (sizeKB > 20_000) {
        return errorResponse("file_too_large", `Il file "${f.name}" supera 20MB`, step.current, 400);
      }
    }

    // --- 2. Check API key ---
    step.current = "checking_api_key";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return errorResponse("missing_api_key", "LOVABLE_API_KEY non configurata", step.current, 500);
    }

    // --- 3. Build OpenAI content parts ---
    step.current = "building_prompt";
    const contentParts: any[] = [];

    for (const f of files) {
      const dataUrl = `data:${f.mimeType};base64,${f.base64}`;
      contentParts.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    const isBookPage = sourceType === "photo-book";

    const contextNote = isBookPage
      ? "Le immagini sono foto di un LIBRO DI TESTO. Analizza TUTTO il contenuto delle pagine: testo narrativo, spiegazioni, didascalie, immagini, tabelle E eventuali esercizi."
      : "Le immagini sono foto del DIARIO SCOLASTICO. Leggi i compiti scritti a mano o stampati.";

    const userInstruction = userNote
      ? `\n\nIMPORTANTE - INDICAZIONE DELLO STUDENTE: "${userNote}"\nConcentrati SOLO sugli esercizi/attività indicati dallo studente.`
      : "";

    const multiFileNote = files.length > 1
      ? `\n\nATTENZIONE: Stai analizzando ${files.length} immagini/pagine che fanno parte dello STESSO compito. Analizzale TUTTE insieme e crea un elenco unificato di task.`
      : "";

    const systemPrompt = isBookPage
      ? `Sei un TRASCRITTORE OCR. Il tuo UNICO compito è COPIARE il testo che vedi nella foto. Non sei un riassuntore. Non sei un interprete. Sei una FOTOCOPIATRICE di testo.

${contextNote}${userInstruction}${multiFileNote}

═══════════════════════════════════════
⚠️ REGOLA ASSOLUTA — TRASCRIZIONE IDENTICA ⚠️
═══════════════════════════════════════
Immagina di essere una persona che RICOPIAVA A MANO i manoscritti nel medioevo: copia OGNI singola parola ESATTAMENTE come la vedi. Non cambiare NULLA.

ESEMPIO DI COSA È VIETATO:
- Testo originale: "La cosa aveva a che fare con lui e col suo gatto, Horace"
- Trascrizione SBAGLIATA: "La cosa assurda era che il suo gatto Horace" ← HAI CAMBIATO LE PAROLE!
- Trascrizione CORRETTA: "La cosa aveva a che fare con lui e col suo gatto, Horace" ← IDENTICA!

VIETATO ASSOLUTAMENTE:
- Cambiare anche UNA SOLA parola del testo originale
- Usare sinonimi (es. "assurda" al posto di "aveva a che fare")
- Riassumere o accorciare qualsiasi frase
- Unire o separare frasi
- Aggiungere parole non presenti nella foto
- Omettere parti del testo, anche se lunghe
- Cambiare l'ordine di qualsiasi elemento
- Inventare esercizi, domande o attività non visibili nella pagina

OBBLIGATORIO:
- Copia il testo CARATTERE PER CARATTERE come lo vedi
- Mantieni la STESSA punteggiatura: virgole, punti, trattini, due punti
- Mantieni gli STESSI a capo e paragrafi
- Se ci sono trattini di dialogo (–), ricopiali esattamente
- Se ci sono numeri di riga, puoi ometterli ma il TESTO deve essere IDENTICO
- Se ci sono note, riferimenti bibliografici, didascalie: trascrivili
- Se una parola è poco leggibile, fai del tuo meglio ma NON inventare

ANALISI DELLA PAGINA — DISTINGUI:

1. **CONTENUTO DA STUDIARE** (testo narrativo, spiegazioni, dialoghi, definizioni)
   → Crea UN compito con la trascrizione COMPLETA e IDENTICA di TUTTO il testo
2. **ESERCIZI** (domande, completamenti, vero/falso, calcoli — SOLO se presenti nella pagina)
   → Crea compiti SEPARATI per ciascun esercizio, trascritti PAROLA PER PAROLA

Se la pagina contiene SOLO testo narrativo e ZERO esercizi, crea SOLO il compito di studio. NON INVENTARE esercizi.

Per ogni elemento, restituisci JSON con:
- "task_types": array (es. ["study"], ["exercise"])
- "subject": materia
- "title": titolo breve (dal titolo visibile nella pagina)
- "description": trascrizione COMPLETA e IDENTICA del testo — OGNI PAROLA DEVE ESSERE UGUALE ALL'ORIGINALE
- "exerciseText": SOLO per exercise → testo IDENTICO dell'esercizio
- "estimatedMinutes": stima tempo
- "difficulty": 1-3

RISPONDI ESCLUSIVAMENTE con un JSON valido: {"tasks": [...]}`
      : `Sei un trascrittore OCR preciso per foto di compiti scolastici italiani (diario, quaderno, foglio stampato).

${contextNote}${userInstruction}${multiFileNote}

REGOLA FONDAMENTALE: Trascrivi ogni compito ed esercizio ESATTAMENTE come scritto. PAROLA PER PAROLA.
- NON inventare, aggiungere o modificare esercizi
- NON riformulare o parafrasare le consegne
- Includi numeri, opzioni di risposta, sotto-domande ESATTAMENTE come appaiono
- Se il testo è poco leggibile, trascrivi al meglio ma NON inventare

Per ogni compito/esercizio trovato, restituisci un oggetto JSON con:
- "task_types": array di stringhe. Valori: "study", "exercise", "memorize", "summarize", "read", "questions", "write", "problem".
- "subject": materia
- "title": titolo breve
- "description": trascrizione LETTERALE del compito/esercizio
- "exerciseText": testo COMPLETO E LETTERALE dell'esercizio come scritto nella foto
- "estimatedMinutes": stima tempo
- "difficulty": 1-3

RISPONDI ESCLUSIVAMENTE con un JSON valido: {"tasks": [...]}`;

    contentParts.push({
      type: "text",
      text: isBookPage
        ? `Analizza ${files.length > 1 ? "tutte queste pagine del libro" : "questa pagina del libro"}. Trascrivi TUTTO il contenuto. Rispondi SOLO con il JSON.`
        : `Analizza ${files.length > 1 ? "tutte queste foto" : "questa foto"} e estrai tutti i compiti. Rispondi SOLO con il JSON.`,
    });

    // --- 4. Call Lovable AI Gateway ---
    step.current = "calling_ai_gateway";
    console.log(`[parse-homework-upload] Chiamata Lovable AI (gemini-2.5-flash) con ${contentParts.length} parti...`);

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
      const errorText = await response.text();
      console.error(`[parse-homework-upload] AI Gateway error ${response.status}: ${errorText}`);
      if (response.status === 429) {
        return errorResponse("rate_limited", "Troppe richieste in questo momento. Aspetta qualche secondo e riprova.", step.current, 429);
      }
      if (response.status === 402) {
        return errorResponse("credits_exhausted", "Crediti AI esauriti. Aggiungi crediti nelle impostazioni Lovable Cloud.", step.current, 402);
      }
      return errorResponse("ai_failed", errorText.slice(0, 500), step.current, 502);
    }

    // --- 5. Parse response ---
    step.current = "parsing_response";
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log(`[parse-homework-upload] Risposta AI ricevuta (${content.length} chars)`);

    let tasks = null;
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      tasks = parsed.tasks || parsed;
    } catch {
      const objMatch = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
      if (objMatch) {
        try { tasks = JSON.parse(objMatch[0]).tasks; } catch { /* ignore */ }
      }
      if (!tasks) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { tasks = JSON.parse(arrMatch[0]); } catch { /* ignore */ }
        }
      }
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      console.warn("[parse-homework-upload] Nessun task estratto dalla risposta");
      return errorResponse(
        "no_tasks_found",
        "Non sono riuscito a estrarre compiti dalla foto. Prova con un'immagine più chiara.",
        step.current,
        422,
      );
    }

    // Normalize task_types
    tasks = tasks.map((t: any) => ({
      ...t,
      task_types: Array.isArray(t.task_types) ? t.task_types : (t.task_type ? [t.task_type] : ["exercise"]),
    }));

    console.log(`[parse-homework-upload] Estratti ${tasks.length} task con successo`);

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[parse-homework-upload] Errore in step="${step.current}":`, e);
    return errorResponse(
      "internal_error",
      e instanceof Error ? e.message : "Errore sconosciuto",
      step.current,
    );
  }
});
