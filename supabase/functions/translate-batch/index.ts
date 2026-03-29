import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, keys, targetLang, sourceLang } = await req.json();

    if (!texts?.length || !targetLang) {
      return new Response(JSON.stringify({ error: "Missing texts or targetLang" }), {
        status: 400,
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

    const langNames: Record<string, string> = {
      es: "Spanish", fr: "French", de: "German", ar: "Arabic", en: "English", it: "Italian",
    };
    const targetName = langNames[targetLang] || targetLang;
    const sourceLabel = sourceLang ? (langNames[sourceLang] || sourceLang) : "Italian";

    // Build a numbered list for the AI
    const numberedTexts = texts.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n");

    const systemPrompt = `You are a professional translator. Translate the following numbered ${sourceLabel} texts to ${targetName}. Return ONLY a JSON array of translated strings in the same order, no numbering, no explanation. Keep placeholders like {{name}} unchanged. Keep HTML tags unchanged. For very short UI labels keep them concise.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: numberedTexts },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Translation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON array from response
    let translations: string[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found");
      }
    } catch {
      console.error("Failed to parse translations:", content);
      translations = texts; // fallback to original
    }

    // Ensure same length
    while (translations.length < texts.length) {
      translations.push(texts[translations.length]);
    }

    return new Response(JSON.stringify({ translations, keys }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-batch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
