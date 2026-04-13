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
    const studentId = formData.get("studentId") as string;
    const files: File[] = [];
    for (const [key, val] of formData.entries()) {
      if (key === "file" && val instanceof File) files.push(val);
    }

    if (!assignmentId || !studentId || files.length === 0) {
      return new Response(JSON.stringify({ error: "Missing assignmentId, studentId or files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the assignment
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

    // Convert images to base64 for GPT-4o vision
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Sei un docente esperto che corregge un compito.

TESTO ORIGINALE DEL COMPITO:
${assignment.description || assignment.title || "Nessuna descrizione disponibile"}

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

    const ocrResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
  } catch (e) {
    console.error("ocr-grade error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
