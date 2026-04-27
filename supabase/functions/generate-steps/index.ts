import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { homeworkTitle, homeworkType, subject, schoolLevel, description, familiarity, lang } = await req.json();

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    const taskTypes = (homeworkType || "exercise").split(",").map((t: string) => t.trim().toLowerCase());
    const isExercise = !taskTypes.some((t: string) =>
      ["study", "memorize", "read", "summarize", "teoria", "memorizzazione", "ripasso"].includes(t)
    );

    const levelConfig: Record<string, { maxSteps: number; style: string }> = isEN
      ? {
          alunno: { maxSteps: 5, style: "Simple language, short sentences. Each step is a micro-activity easy for a child to understand." },
          medie: { maxSteps: 5, style: "Simple but structured language. Clear and sequential steps." },
          superiori: { maxSteps: 7, style: "Strategic and progressive steps. Direct language." },
          universitario: { maxSteps: 8, style: "Dense and methodological steps. Appropriate technical terminology." },
        }
      : {
          alunno: { maxSteps: 5, style: "Linguaggio semplice, frasi brevi. Ogni step è una micro-attività facile da capire per un bambino." },
          medie: { maxSteps: 5, style: "Linguaggio semplice ma strutturato. Step chiari e sequenziali." },
          superiori: { maxSteps: 7, style: "Step strategici e progressivi. Linguaggio diretto." },
          universitario: { maxSteps: 8, style: "Step densi e metodologici. Terminologia tecnica appropriata." },
        };

    const config = levelConfig[schoolLevel] || levelConfig.superiori;
    const hasContent = !!description;

    let taskInstructions: string;

    if (isExercise) {
      taskInstructions = isEN
        ? `This is an EXERCISE to solve. Steps must use the EXACT exercise text already provided in the attached content:
- If the attached content contains multiple exercises, create ONE step per exercise, in the SAME order
- NEVER create a step like "identify the data", "which numbers do you see", or "what operation is required" — the coach already has the data
- NEVER ask the student to copy, rewrite, or re-list the exercise
- First create a brief theory/method step, then create steps that each QUOTE the exact exercise text
- For each exercise step, include the exact operation/value/formula as written in the source content
- DO NOT ask if the student knows the rule before proceeding; explain the needed method briefly first
- ABSOLUTE RULE: NEVER modify, paraphrase, round, or substitute ANY number, value, formula, unit, or data from the original exercise. Use EXCLUSIVELY the exact values provided. Any variation is a serious error.`
        : `Questo è un ESERCIZIO da risolvere. Gli step devono usare il testo ESATTO degli esercizi già presenti nel contenuto allegato:
- Se il contenuto allegato contiene più esercizi, crea UNO step per ogni esercizio, nello STESSO ordine
- NON creare MAI uno step del tipo "identifica i dati", "quali numeri vedi" o "quale operazione devi fare" — il coach ha già i dati
- NON chiedere MAI allo studente di copiare, riscrivere o rielencare l'esercizio
- Crea prima un breve step di teoria/metodo, poi step che riportano ciascun esercizio citando il testo esatto
- In ogni step esercizio, includi l'operazione/valore/formula esattamente come scritti nel contenuto sorgente
- NON chiedere se lo studente conosce la regola prima di procedere; spiega prima brevemente il metodo necessario
- REGOLA ASSOLUTA: Non modificare, parafrasare, arrotondare o sostituire MAI nessun numero, valore, formula, unità di misura o dato presente nell'esercizio originale. Usa esclusivamente i valori esatti forniti. Qualsiasi variazione dei dati originali è un errore grave.`;
    } else if (familiarity === "first_time") {
      taskInstructions = isEN
        ? `This is STUDYING a topic the student has NEVER STUDIED. It's the FIRST TIME.
${hasContent ? `\nYou have the FULL TEXT of the topic (see below). You MUST create steps that follow the actual text content, divided into logical blocks.\n` : ""}
FUNDAMENTAL RULES:
- Steps 1-3: The coach PRESENTS the content${hasContent ? " USING THE ATTACHED TEXT" : ""}, explaining it one block at a time. Each step must indicate WHICH PART of the text to present. At the end of each block, ask ONE CONCRETE AND SPECIFIC QUESTION about what was just explained.
- Middle steps: Verify comprehension with targeted questions on actual content (Bloom L2-L3)
- Final steps: Active recall — ask to repeat concepts from memory WITHOUT looking at the text (Bloom L3-L4)
- Last step: Mini oral simulation

IMPORTANT: Each step MUST end with a clear question.
IMPORTANT: Steps must be SPECIFIC to the text content, NOT generic.
IMPORTANT: The coach PRESENTS AND EXPLAINS the text to the student (who has never read it). THEN asks a question.`
        : `Questo è uno STUDIO di un argomento che lo studente NON HA MAI STUDIATO. È la PRIMA VOLTA.
${hasContent ? `\nHai a disposizione il TESTO COMPLETO dell'argomento (vedi sotto). DEVI creare step che seguono il contenuto reale del testo, diviso in blocchi logici.\n` : ""}
REGOLE FONDAMENTALI:
- Step 1-3: Il coach PRESENTA il contenuto${hasContent ? " USANDO IL TESTO ALLEGATO" : ""}, spiegandolo un blocco alla volta. Ogni step deve indicare QUALE PARTE del testo presentare. Alla fine di ogni blocco, fai UNA DOMANDA CONCRETA E SPECIFICA su quello che hai appena spiegato.
- Step intermedi: Verifica la comprensione con domande mirate sul contenuto reale (Bloom L2-L3)
- Step finali: Richiamo attivo — chiedi di ripetere i concetti dalla memoria SENZA guardare il testo (Bloom L3-L4)
- Ultimo step: Mini simulazione orale

IMPORTANTE: Ogni step DEVE terminare con una domanda chiara.
IMPORTANTE: Gli step devono essere SPECIFICI per il contenuto del testo, NON generici.
IMPORTANTE: Il coach PRESENTA E SPIEGA il testo allo studente (che non lo ha mai letto). POI fa una domanda.`;
    } else if (familiarity === "already_know") {
      taskInstructions = isEN
        ? `This is REVIEW/VERIFICATION of a topic the student says they ALREADY KNOW.

RULES:
- Step 1: Ask the student to explain the topic from memory, WITHOUT looking at materials
- Steps 2-3: Targeted questions on key points to verify mastery (Bloom L2-L3)
- Middle steps: Deepen any gaps that emerge (Bloom L3-L4)
- Final steps: Oral simulation with tricky questions (Bloom L5-L6)
- DO NOT re-read — start from active recall`
        : `Questo è RIPASSO/VERIFICA di un argomento che lo studente dice di CONOSCERE GIÀ.

REGOLE:
- Step 1: Chiedi allo studente di spiegare l'argomento dalla memoria, SENZA guardare il materiale
- Step 2-3: Domande mirate sui punti chiave per verificare la padronanza (Bloom L2-L3)
- Step intermedi: Approfondisci eventuali lacune emerse (Bloom L3-L4)
- Step finali: Simulazione orale con domande "trabocchetto" (Bloom L5-L6)
- NON far rileggere — parti dal richiamo attivo`;
    } else if (familiarity === "partial") {
      taskInstructions = isEN
        ? `This is PARTIAL STUDY — the student only PARTIALLY knows the topic.

RULES:
- Step 1: Ask the student what they've already studied and where they stopped
- Steps 2-3: Complete the missing parts with clear explanations
- Middle steps: Active recall on already-studied + new parts (Bloom L2-L3)
- Final steps: Guided repetition of the entire topic (Bloom L4-L5)
- Last step: Mini oral simulation`
        : `Questo è STUDIO PARZIALE — lo studente conosce SOLO IN PARTE l'argomento.

REGOLE:
- Step 1: Chiedi allo studente cosa ha già studiato e dove si è fermato
- Step 2-3: Completa le parti mancanti con spiegazioni chiare
- Step intermedi: Richiamo attivo sulle parti già studiate + nuove (Bloom L2-L3)
- Step finali: Ripetizione guidata dell'intero argomento (Bloom L4-L5)
- Ultimo step: Mini simulazione orale`;
    } else {
      taskInstructions = isEN
        ? `This is STUDY/REVIEW. Steps should verify comprehension:
- Start with specific questions on the topic (Bloom L1-L2)
- Progressively move toward analysis and synthesis (Bloom L3-L6)
- Each step is an open question that verifies mastery`
        : `Questo è uno STUDIO/RIPETIZIONE. Gli step devono verificare la comprensione:
- Parti da domande specifiche sull'argomento (Bloom L1-L2)
- Sali progressivamente verso analisi e sintesi (Bloom L3-L6)
- Ogni step è una domanda aperta che verifica la padronanza`;
    }

    const goalLabels: Record<string, string> = isEN
      ? { study: "study and understand", memorize: "memorize", read: "read and comprehend", summarize: "summarize", exercise: "do exercises", questions: "answer questions", write: "write a text", problem: "solve problems" }
      : { study: "studiare e capire", memorize: "memorizzare", read: "leggere e comprendere", summarize: "riassumere", exercise: "fare esercizi", questions: "rispondere a domande", write: "scrivere un testo", problem: "risolvere problemi" };

    const goalStr = taskTypes.length > 0
      ? `${isEN ? "SESSION GOAL" : "OBIETTIVO della sessione"}: ${taskTypes.map((t: string) => goalLabels[t] || t).join(" + ")}. ${isEN ? "Steps must lead the student to achieve ALL these goals." : "Gli step devono portare lo studente a raggiungere TUTTI questi obiettivi."}`
      : "";

    const systemPrompt = isEN
      ? `You are an expert in instructional design. Break the following task into progressive micro-steps for guided study.

Rules:
- Maximum ${config.maxSteps} steps
- ${config.style}
- ${taskInstructions}
${goalStr ? `- ${goalStr}` : ""}
- Follow Bloom's Taxonomy: start from L1 and progressively rise
- Output ONLY valid JSON, no extra text
- All content must be in English

Output format:
{"steps":[{"number":1,"text":"...","bloomLevel":1}]}`
      : `Sei un esperto di progettazione didattica. Scomponi il seguente compito in micro-step progressivi per lo studio guidato.

Regole:
- Massimo ${config.maxSteps} step
- ${config.style}
- ${taskInstructions}
${goalStr ? `- ${goalStr}` : ""}
- Segui la Tassonomia di Bloom: parti da L1 e sali progressivamente
- Output SOLO JSON valido, nessun testo extra

Formato output:
{"steps":[{"number":1,"text":"...","bloomLevel":1}]}`;

    const userPrompt = isEN
      ? `Task: ${homeworkTitle}
Type: ${homeworkType || "exercise"}
Subject: ${subject}
Student familiarity: ${familiarity || "not specified"}
${description ? `\nTEXT/CONTENT ATTACHED TO THE TASK (this is the study material):\n---\n${description}\n---` : ""}`
      : `Compito: ${homeworkTitle}
Tipo: ${homeworkType || "exercise"}
Materia: ${subject}
Familiarità studente: ${familiarity || "non specificata"}
${description ? `\nTESTO/CONTENUTO ALLEGATO AL COMPITO (questo è il materiale da studiare):\n---\n${description}\n---` : ""}`;

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
