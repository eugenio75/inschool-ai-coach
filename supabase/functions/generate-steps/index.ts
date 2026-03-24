import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { homeworkTitle, homeworkType, subject, schoolLevel, description, familiarity } = await req.json();

    const taskTypes = (homeworkType || "exercise").split(",").map((t: string) => t.trim().toLowerCase());
    const isExercise = !taskTypes.some((t: string) =>
      ["study", "memorize", "read", "summarize", "teoria", "memorizzazione", "ripasso"].includes(t)
    );

    const levelConfig: Record<string, { maxSteps: number; style: string }> = {
      alunno: { maxSteps: 5, style: "Linguaggio semplice, frasi brevi. Ogni step è una micro-attività facile da capire per un bambino." },
      medie: { maxSteps: 5, style: "Linguaggio semplice ma strutturato. Step chiari e sequenziali." },
      superiori: { maxSteps: 7, style: "Step strategici e progressivi. Linguaggio diretto." },
      universitario: { maxSteps: 8, style: "Step densi e metodologici. Terminologia tecnica appropriata." },
    };

    const config = levelConfig[schoolLevel] || levelConfig.superiori;

    let taskInstructions: string;

    if (isExercise) {
      taskInstructions = `Questo è un ESERCIZIO da risolvere. Gli step devono guidare lo studente verso la SOLUZIONE:
- Step 1: Identifica i dati e cosa chiede il problema
- Step successivi: Guida il ragionamento passo-passo verso la soluzione
- Se servono formule/regole, chiedi allo studente se le conosce prima di procedere
- Ogni step deve essere una domanda che fa RAGIONARE sullo step logico successivo della risoluzione
- NON chiedere "cosa sai già" o "descrivi con parole tue" — vai dritto al problema`;
    } else if (familiarity === "first_time") {
      taskInstructions = `Questo è uno STUDIO di un argomento che lo studente NON HA MAI STUDIATO. È la PRIMA VOLTA.

REGOLE FONDAMENTALI:
- Step 1: Il coach PRESENTA il contenuto al ragazzo, spiegandoglielo un blocco alla volta. NON fare domande al primo step.
- Step 2-3: Continua a presentare e spiegare i blocchi successivi, con domande SEMPLICI di comprensione dopo ogni spiegazione
- Step intermedi: Verifica che lo studente abbia capito con domande di comprensione (Bloom L1-L2)
- Step finali: Richiamo attivo — chiedi di ripetere i concetti dalla memoria (Bloom L3-L4)
- Ultimo step: Mini simulazione orale

IMPORTANTE: Lo studente NON conosce ancora l'argomento. Il coach deve PRIMA spiegare, POI verificare la comprensione. MAI partire con domande su un argomento mai visto.`;
    } else if (familiarity === "already_know") {
      taskInstructions = `Questo è RIPASSO/VERIFICA di un argomento che lo studente dice di CONOSCERE GIÀ.

REGOLE:
- Step 1: Chiedi allo studente di spiegare l'argomento dalla memoria, SENZA guardare il materiale
- Step 2-3: Domande mirate sui punti chiave per verificare la padronanza (Bloom L2-L3)
- Step intermedi: Approfondisci eventuali lacune emerse (Bloom L3-L4)
- Step finali: Simulazione orale con domande "trabocchetto" (Bloom L5-L6)
- NON far rileggere — parti dal richiamo attivo`;
    } else if (familiarity === "partial") {
      taskInstructions = `Questo è STUDIO PARZIALE — lo studente conosce SOLO IN PARTE l'argomento.

REGOLE:
- Step 1: Chiedi allo studente cosa ha già studiato e dove si è fermato
- Step 2-3: Completa le parti mancanti con spiegazioni chiare
- Step intermedi: Richiamo attivo sulle parti già studiate + nuove (Bloom L2-L3)
- Step finali: Ripetizione guidata dell'intero argomento (Bloom L4-L5)
- Ultimo step: Mini simulazione orale`;
    } else {
      taskInstructions = `Questo è uno STUDIO/RIPETIZIONE. Gli step devono verificare la comprensione:
- Parti da domande specifiche sull'argomento (Bloom L1-L2)
- Sali progressivamente verso analisi e sintesi (Bloom L3-L6)
- Ogni step è una domanda aperta che verifica la padronanza`;
    }

    const systemPrompt = `Sei un esperto di progettazione didattica. Scomponi il seguente compito in micro-step progressivi per lo studio guidato.

Regole:
- Massimo ${config.maxSteps} step
- ${config.style}
- ${taskInstructions}
- Segui la Tassonomia di Bloom: parti da L1 e sali progressivamente
- Output SOLO JSON valido, nessun testo extra

Formato output:
{"steps":[{"number":1,"text":"...","bloomLevel":1}]}`;

    const userPrompt = `Compito: ${homeworkTitle}
Tipo: ${homeworkType || "exercise"}
Materia: ${subject}
Familiarità studente: ${familiarity || "non specificata"}
${description ? `Descrizione/Contenuto: ${description}` : ""}`;

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
