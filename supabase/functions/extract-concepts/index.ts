import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatMessages, taskSubject, taskTitle, childProfileId, accessCode, lang } = await req.json();

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    if (!chatMessages || chatMessages.length < 3) {
      return new Response(JSON.stringify({ concepts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let resolvedChildId = childProfileId;

    if (accessCode) {
      const { data: codeResult } = await supabase.rpc("validate_child_code", { code: accessCode });
      if (!codeResult?.valid) {
        return new Response(JSON.stringify({ error: isEN ? "Invalid code" : "Codice non valido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedChildId = codeResult.profile.id;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: isEN ? "Unauthorized" : "Non autorizzato" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: isEN ? "Unauthorized" : "Non autorizzato" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!resolvedChildId) {
      return new Response(JSON.stringify({ concepts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: childProfile } = await supabase
      .from("child_profiles")
      .select("name")
      .eq("id", resolvedChildId)
      .maybeSingle();
    const studentName = childProfile?.name || (isEN ? "The student" : "Lo studente");

    const conversationText = chatMessages
      .filter((m: any) => typeof m.text === "string" && m.text.trim())
      .map((m: any) => `${m.role === "coach" ? "Coach" : (isEN ? "Student" : "Studente")}: ${m.text}`)
      .join("\n");

    const extractPrompt = isEN
      ? `Analyze this study conversation between an AI coach and ${studentName}.
Extract the KEY CONCEPTS that ${studentName} learned or worked on during the session.

Subject: ${taskSubject || "not specified"}
Topic: ${taskTitle || "not specified"}

Conversation:
${conversationText}

Reply ONLY with a JSON array of objects, each with:
- "concept": the short concept name (max 6 words)
- "summary": a 1-2 sentence summary of what ${studentName} understood/worked on. ALWAYS use the name "${studentName}" and never "the student".
- "recall_questions": array of 2-3 review questions to verify understanding
- "strength": a number from 20 to 80 estimating how well ${studentName} understood (based on chat responses)

Extract 1 to 4 concepts. If the conversation is too short or doesn't contain significant learning, reply with an empty array [].

Reply ONLY with JSON, no markdown or other text.`
      : `Analizza questa conversazione di studio tra un coach AI e ${studentName}.
Estrai i CONCETTI CHIAVE che ${studentName} ha imparato o su cui ha lavorato durante la sessione.

Materia: ${taskSubject || "non specificata"}
Argomento: ${taskTitle || "non specificato"}

Conversazione:
${conversationText}

Rispondi SOLO con un JSON array di oggetti, ognuno con:
- "concept": il nome breve del concetto (max 6 parole)
- "summary": un riassunto di 1-2 frasi di cosa ${studentName} ha capito/lavorato. Usa SEMPRE il nome "${studentName}" e mai "lo studente".
- "recall_questions": array di 2-3 domande di ripasso per verificare la comprensione
- "strength": un numero da 20 a 80 che stima quanto bene ${studentName} ha capito (basandoti sulle risposte nella chat)

Estrai da 1 a 4 concetti. Se la conversazione è troppo breve o non contiene apprendimento significativo, rispondi con un array vuoto [].

Rispondi SOLO con il JSON, senza markdown o altro testo.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: extractPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI extraction error:", aiResponse.status);
      return new Response(JSON.stringify({ concepts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let rawText = aiData.choices?.[0]?.message?.content || "[]";
    rawText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let concepts: any[] = [];
    try {
      concepts = JSON.parse(rawText);
      if (!Array.isArray(concepts)) concepts = [];
    } catch {
      console.error("Failed to parse concepts:", rawText);
      concepts = [];
    }

    if (concepts.length > 0) {
      const items = concepts.map((c: any) => ({
        child_profile_id: resolvedChildId,
        subject: taskSubject || (isEN ? "General" : "Generale"),
        concept: c.concept || (isEN ? "Concept" : "Concetto"),
        summary: c.summary || "",
        recall_questions: c.recall_questions || [],
        strength: Math.max(20, Math.min(80, c.strength || 50)),
      }));

      for (const item of items) {
        const { data: existing } = await supabase
          .from("memory_items")
          .select("id, strength")
          .eq("child_profile_id", resolvedChildId)
          .eq("subject", item.subject)
          .eq("concept", item.concept)
          .maybeSingle();

        if (existing) {
          const newStrength = Math.round((existing.strength + item.strength) / 2);
          await supabase
            .from("memory_items")
            .update({ strength: newStrength, last_reviewed: new Date().toISOString(), summary: item.summary, recall_questions: item.recall_questions })
            .eq("id", existing.id);
        } else {
          await supabase.from("memory_items").insert(item);
        }
      }
    }

    return new Response(JSON.stringify({ concepts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-concepts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
