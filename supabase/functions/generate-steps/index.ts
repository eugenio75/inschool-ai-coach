import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { homeworkTitle, homeworkType, subject, schoolLevel, description } = await req.json();

    const isExercise = (homeworkType || "exercise") !== "study";

    const levelConfig: Record<string, { maxSteps: number; style: string }> = {
      alunno: { maxSteps: 5, style: "Linguaggio semplice, frasi brevi. Ogni step è una micro-domanda facile da capire per un bambino." },
      medie: { maxSteps: 5, style: "Linguaggio semplice ma strutturato. Step chiari e sequenziali." },
      superiori: { maxSteps: 7, style: "Step strategici: comprensione → analisi → sintesi → autoverifica. Linguaggio diretto." },
      universitario: { maxSteps: 8, style: "Step densi e metodologici. Terminologia tecnica appropriata." },
    };

    const config = levelConfig[schoolLevel] || levelConfig.superiori;

    const exerciseInstructions = isExercise
      ? `Questo è un ESERCIZIO da risolvere. Gli step devono guidare lo studente verso la SOLUZIONE:
- Step 1: Identifica i dati e cosa chiede il problema
- Step successivi: Guida il ragionamento passo-passo verso la soluzione
- Se servono formule/regole, chiedi allo studente se le conosce prima di procedere
- Ogni step deve essere una domanda che fa RAGIONARE sullo step logico successivo della risoluzione
- NON chiedere "cosa sai già" o "descrivi con parole tue" — vai dritto al problema`
      : `Questo è uno STUDIO/RIPETIZIONE. Gli step devono verificare la comprensione:
- Parti da domande specifiche sull'argomento (Bloom L1-L2)
- Sali progressivamente verso analisi e sintesi (Bloom L3-L6)
- Ogni step è una domanda aperta che verifica la padronanza`;

    const systemPrompt = `Sei un esperto di progettazione didattica. Scomponi il seguente compito in micro-step progressivi per lo studio guidato.

Regole:
- Massimo ${config.maxSteps} step
- ${config.style}
- ${exerciseInstructions}
- Segui la Tassonomia di Bloom: parti da L1 e sali progressivamente
- Output SOLO JSON valido, nessun testo extra

Formato output:
{"steps":[{"number":1,"text":"...","bloomLevel":1}]}`;

    const userPrompt = `Compito: ${homeworkTitle}
Tipo: ${homeworkType || "exercise"}
Materia: ${subject}
${description ? `Descrizione: ${description}` : ""}`;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in response");
    
    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({
      steps: parsed.steps,
      totalSteps: parsed.steps.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-steps error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
