// ═══════════════════════════════════════════════════════════════
// ANALYZE OPENING TONE
// Analizza il testo del momento di apertura giornaliero dello studente.
// Restituisce SOLO il tono calibrato: "heavy" | "neutral" | "positive".
// Il testo grezzo NON viene mai salvato, mai loggato, mai restituito.
// ═══════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ tone: "neutral" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = text.trim().slice(0, 500);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ tone: "neutral" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Sei un classificatore di tono. Leggi il messaggio breve di uno studente e restituisci SOLO una di queste tre etichette esatte: heavy, neutral, positive. heavy=stanchezza/tristezza/ansia/peso emotivo. positive=energia/entusiasmo/serenità. neutral=tutto il resto. Rispondi con UNA SOLA parola.",
          },
          { role: "user", content: trimmed },
        ],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      // Fail-safe: neutrale, niente leak del testo nei log
      return new Response(JSON.stringify({ tone: "neutral" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = (data?.choices?.[0]?.message?.content || "").toLowerCase().trim();
    let tone: "heavy" | "neutral" | "positive" = "neutral";
    if (raw.includes("heavy")) tone = "heavy";
    else if (raw.includes("positive")) tone = "positive";

    return new Response(JSON.stringify({ tone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Mai loggare il testo grezzo
    console.error("analyze-opening-tone error:", e instanceof Error ? e.message : "unknown");
    return new Response(JSON.stringify({ tone: "neutral" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
