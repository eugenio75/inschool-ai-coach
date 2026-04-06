import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, conversationHistory, schoolLevel, lang } = await req.json();

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    const levelConfig: Record<string, { maxCards: number; style: string }> = isEN
      ? {
          alunno: { maxCards: 8, style: "Simple language. One word/concept per card. Direct questions." },
          medie: { maxCards: 8, style: "Clear language. Simple definitions and connections." },
          superiori: { maxCards: 12, style: "Definitions, cause-effect, connections between concepts." },
          universitario: { maxCards: 15, style: "Technical terminology. Dense and precise fragments." },
        }
      : {
          alunno: { maxCards: 8, style: "Linguaggio semplice. Una parola/concetto per carta. Domande dirette." },
          medie: { maxCards: 8, style: "Linguaggio chiaro. Definizioni e connessioni semplici." },
          superiori: { maxCards: 12, style: "Definizioni, causa-effetto, connessioni tra concetti." },
          universitario: { maxCards: 15, style: "Terminologia tecnica. Frammenti densi e precisi." },
        };

    const config = levelConfig[schoolLevel] || levelConfig.superiori;

    const conversationText = Array.isArray(conversationHistory)
      ? conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join("\n")
      : String(conversationHistory || "");

    // Detect if the caller is requesting a custom format (challenges, games, etc.)
    const isCustomFormat = conversationText.includes('Formato JSON:') || conversationText.includes('Formato:');

    const systemPrompt = isCustomFormat
      ? (isEN
        ? `You are a teaching expert. Follow the user's instructions EXACTLY. Output ONLY valid JSON matching the format they specify. All content must be in English.`
        : `Sei un esperto di didattica. Segui le istruzioni dell'utente ESATTAMENTE. Output SOLO JSON valido nel formato che specificano.`)
      : isEN
      ? `You are a teaching expert. Generate review flashcards from the study session content.

Rules:
- Maximum ${config.maxCards} cards
- ${config.style}
- Difficulty 1: simple definitions
- Difficulty 2: cause-effect connections
- Difficulty 3: application and reasoning
- Output ONLY valid JSON
- All content must be in English

Format: {"cards":[{"question":"...","answer":"...","difficulty":1}]}`
      : `Sei un esperto di didattica. Genera flashcard di ripasso dai contenuti della sessione di studio.

Regole:
- Massimo ${config.maxCards} carte
- ${config.style}
- Difficoltà 1: definizioni semplici
- Difficoltà 2: connessioni causa-effetto
- Difficoltà 3: applicazione e ragionamento
- Output SOLO JSON valido

Formato: {"cards":[{"question":"...","answer":"...","difficulty":1}]}`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isEN
            ? `Subject: ${subject}\n\nConversation:\n${conversationText}`
            : `Materia: ${subject}\n\nConversazione:\n${conversationText}` },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ cards: parsed.cards }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-flashcards error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
