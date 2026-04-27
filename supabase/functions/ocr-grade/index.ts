import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const assignmentId = formData.get("assignmentId") as string;
    const mode = formData.get("mode") as string || "single"; // "single" | "batch"
    const studentId = formData.get("studentId") as string; // used in single mode
    const studentListRaw = formData.get("studentList") as string; // JSON array for batch mode

    const files: File[] = [];
    for (const [key, val] of formData.entries()) {
      if (key === "file" && val instanceof File) files.push(val);
    }

    if (!assignmentId || files.length === 0) {
      return new Response(JSON.stringify({ error: "Missing assignmentId or files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "single" && !studentId) {
      return new Response(JSON.stringify({ error: "Missing studentId for single mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: assignment, error: aErr } = await sb
      .from("teacher_assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse student list for batch matching
    let studentNames: Array<{ id: string; name: string }> = [];
    if (mode === "batch" && studentListRaw) {
      try { studentNames = JSON.parse(studentListRaw); } catch { /* ignore */ }
    }

    const assignmentDesc = assignment.description || assignment.title || "Nessuna descrizione disponibile";

    // Helper: process a single file
    async function processFile(file: File): Promise<any> {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const mimeType = file.type || "image/jpeg";
      const imageContent = {
        type: "image_url" as const,
        image_url: { url: `data:${mimeType};base64,${base64}` },
      };

      const isBatch = mode === "batch";
      const studentListStr = isBatch && studentNames.length > 0
        ? `\n\nLISTA STUDENTI DELLA CLASSE:\n${studentNames.map(s => `- ${s.name}`).join("\n")}\n\nCERCA IL NOME DELLO STUDENTE scritto a mano nell'intestazione del foglio (campo "Nome e Cognome"). Restituisci il nome esatto dalla lista sopra che corrisponde meglio. Se non riesci a leggere il nome, usa "NON_RILEVATO".`
        : "";

      const systemPrompt = `Sei un docente esperto che corregge un compito.

TESTO ORIGINALE DEL COMPITO:
${assignmentDesc}
${studentListStr}

Correggi le risposte dello studente confrontandole con il compito originale.
Per ogni domanda indica: corretto / parzialmente corretto / sbagliato + motivazione breve.
Calcola il punteggio finale su 10.
Identifica i principali errori e lacune.
Rispondi in italiano.

FORMATO DI RISPOSTA (JSON):
{
  ${isBatch ? `"detected_student_name": "nome studente rilevato dalla lista o NON_RILEVATO",` : ""}
  "ocr_text": "testo estratto dalla foto dello studente",
  "corrections": [
    { "question": "domanda/esercizio", "answer": "risposta studente", "result": "corretto|parzialmente_corretto|sbagliato", "explanation": "motivazione breve" }
  ],
  "proposed_score": 7.5,
  "total_score": 10,
  "errors": ["lista errori principali"],
  "summary": "riassunto breve della correzione"
}`;

      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Ecco la foto del compito svolto dallo studente. Estrai il testo, correggi e valuta." },
                imageContent,
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      });

      if (!ocrResponse.ok) {
        const errText = await ocrResponse.text();
        console.error("OpenAI error:", ocrResponse.status, errText);
        return { error: "AI grading failed", fileName: file.name };
      }

      const ocrData = await ocrResponse.json();
      const content = ocrData.choices?.[0]?.message?.content;

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { ocr_text: content, corrections: [], proposed_score: 0, total_score: 10, errors: [], summary: content };
      }

      // For batch mode: try to match detected name to student list
      let matchedStudent: { id: string; name: string } | null = null;
      if (isBatch && parsed.detected_student_name && parsed.detected_student_name !== "NON_RILEVATO") {
        const detected = parsed.detected_student_name.toLowerCase().trim();
        // Exact match first
        matchedStudent = studentNames.find(s => s.name.toLowerCase().trim() === detected) || null;
        // Fuzzy: check if detected contains last name or vice versa
        if (!matchedStudent) {
          matchedStudent = studentNames.find(s => {
            const sLower = s.name.toLowerCase();
            return sLower.includes(detected) || detected.includes(sLower) ||
              detected.split(/\s+/).some(w => w.length > 2 && sLower.includes(w));
          }) || null;
        }
      }

      return {
        success: true,
        fileName: file.name,
        detected_student_name: parsed.detected_student_name || null,
        matched_student: matchedStudent,
        ocr_text: parsed.ocr_text || "",
        corrections: parsed.corrections || [],
        proposed_score: parsed.proposed_score ?? 0,
        total_score: parsed.total_score ?? 10,
        errors: parsed.errors || [],
        summary: parsed.summary || "",
      };
    }

    if (mode === "batch") {
      // Process all files in parallel (max 5 concurrent)
      const results = await Promise.all(files.map(f => processFile(f)));
      return new Response(JSON.stringify({ success: true, mode: "batch", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Single mode — process all files as one student submission
      const imageContents: Array<{ type: string; image_url: { url: string } }> = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const mimeType = file.type || "image/jpeg";
        imageContents.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        });
      }

      const systemPrompt = `Sei un docente esperto che corregge un compito.

TESTO ORIGINALE DEL COMPITO:
${assignmentDesc}

Correggi le risposte dello studente confrontandole con il compito originale.
Per ogni domanda indica: corretto / parzialmente corretto / sbagliato + motivazione breve.
Calcola il punteggio finale su 10.
Identifica i principali errori e lacune.
Rispondi in italiano.

FORMATO DI RISPOSTA (JSON):
{
  "ocr_text": "testo estratto dalla foto dello studente",
  "corrections": [
    { "question": "domanda/esercizio", "answer": "risposta studente", "result": "corretto|parzialmente_corretto|sbagliato", "explanation": "motivazione breve" }
  ],
  "proposed_score": 7.5,
  "total_score": 10,
  "errors": ["lista errori principali"],
  "summary": "riassunto breve della correzione"
}`;

      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Ecco la foto del compito svolto dallo studente. Estrai il testo, correggi e valuta." },
                ...imageContents,
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      });

      if (!ocrResponse.ok) {
        const errText = await ocrResponse.text();
        console.error("OpenAI error:", ocrResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI grading failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ocrData = await ocrResponse.json();
      const content = ocrData.choices?.[0]?.message?.content;

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { ocr_text: content, corrections: [], proposed_score: 0, total_score: 10, errors: [], summary: content };
      }

      return new Response(JSON.stringify({
        success: true,
        ocr_text: parsed.ocr_text || "",
        corrections: parsed.corrections || [],
        proposed_score: parsed.proposed_score ?? 0,
        total_score: parsed.total_score ?? 10,
        errors: parsed.errors || [],
        summary: parsed.summary || "",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("ocr-grade error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
