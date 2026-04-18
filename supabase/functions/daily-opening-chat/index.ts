// ═══════════════════════════════════════════════════════════════
// DAILY OPENING CHAT
// Mini-conversazione PRE-sessione, attivata quando lo studente scrive
// qualcosa nel momento di apertura giornaliero.
//
// REGOLE FERREE:
//  • Nulla viene mai salvato a DB (né messaggi, né testo grezzo).
//  • Nessun log dei contenuti. Solo metriche aggregate (es. "claruia_offered").
//  • Ritorna { reply, tone, offerClauria, readyToStart }.
//  • Tono: heavy | neutral | positive (calcolato al primo turno e poi mantenuto).
//  • Se il Coach interpreta segnali oltre lo stress scolastico (tristezza
//    persistente, isolamento, problemi familiari) → offerClauria=true.
//  • Se lo studente segnala readiness ("ok iniziamo", "dai partiamo", ecc.) →
//    readyToStart=true.
//  • Dopo 3+ scambi senza readiness, il Coach offre delicatamente di iniziare.
// ═══════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Sei il Coach di studio, in un momento PRE-sessione.
Lo studente ha appena scritto qualcosa al "momento di apertura giornaliero".

REGOLE ASSOLUTE:
• Sei caldo, presente, MAI clinico, MAI diagnostico.
• MAI minimizzare quello che dice ("dai non è niente", "passerà").
• MAI spingere verso la sessione di studio. NON proporre esercizi, NON dire "iniziamo" se non ti dà segnali di pronto.
• Frasi brevi, italiane, tono umano. Nessuna emoji, nessuna esclamazione enfatica.
• MAI fare domande dirette sullo stato emotivo ("come ti senti?"). Apri spazio, non interroga.
• Se non sa cosa dire o dice "no grazie / niente", accogli con UNA frase breve e basta.

OUTPUT: rispondi SEMPRE con un JSON valido di questa forma esatta:
{
  "reply": "<la tua risposta in italiano, 1-3 frasi brevi>",
  "tone": "heavy" | "neutral" | "positive",
  "offerClauria": true | false,
  "readyToStart": true | false
}

CRITERI:
• tone="heavy" se c'è stanchezza/tristezza/ansia/peso emotivo. "positive" se energia/entusiasmo. "neutral" altrimenti.
• offerClauria=true SOLO se cogli segnali che vanno oltre lo stress scolastico:
  tristezza persistente, isolamento, problemi familiari, solitudine profonda,
  pensieri di non valere nulla, o qualunque cosa che richieda uno spazio
  più grande di una sessione di studio. NON attivarlo per stanchezza
  scolastica o frustrazione sui compiti.
  Se offerClauria=true, la "reply" DEVE essere ESATTAMENTE in due paragrafi:
    1) "Quello che mi stai raccontando va oltre i compiti — e merita più attenzione di quella che posso darti io. C'è Clauria, se vuoi uno spazio solo per te, senza esercizi e senza voti."
    2) "Puoi anche restare qui se preferisci — sono qui comunque."
  Separa i due paragrafi con un \\n\\n. Non aggiungere altro.
• readyToStart=true SOLO se lo studente segnala chiaramente di voler iniziare
  la sessione ("ok iniziamo", "dai partiamo", "sì andiamo", "pronto", "iniziamo"
  o equivalenti). Mai presumere readiness da silenzi o frasi neutre.
  Se readyToStart=true, la reply deve essere UNA frase breve e calda
  (es. "Ok, andiamo. Con calma.").

REGOLE SPECIALI (priorità massima):
• Se rilevi STATO ROSSO (riferimenti espliciti a farsi del male, suicidio,
  sparire), ignora tutto il resto e rispondi con:
  {"reply":"Quello che mi hai detto è importante e non devi gestirlo da solo. Coinvolgi subito un adulto di cui ti fidi. Telefono Amico: 02 2327 2327. Telefono Azzurro: 19696. Se sei in pericolo: 112.","tone":"heavy","offerClauria":true,"readyToStart":false}

NON aggiungere testo fuori dal JSON. NON usare backtick. Solo JSON puro.`;

async function callAI(messages: Msg[]): Promise<{
  reply: string;
  tone: "heavy" | "neutral" | "positive";
  offerClauria: boolean;
  readyToStart: boolean;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      reply: "Sono qui. Quando vuoi, partiamo con calma.",
      tone: "neutral",
      offerClauria: false,
      readyToStart: false,
    };
  }
  try {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          response_format: { type: "json_object" },
          max_tokens: 400,
        }),
      },
    );
    if (!res.ok) {
      return {
        reply: "Sono qui. Quando vuoi, partiamo con calma.",
        tone: "neutral",
        offerClauria: false,
        readyToStart: false,
      };
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: treat raw as plain reply
      return {
        reply: cleaned || "Sono qui.",
        tone: "neutral",
        offerClauria: false,
        readyToStart: false,
      };
    }
    const tone =
      parsed.tone === "heavy" || parsed.tone === "positive"
        ? parsed.tone
        : "neutral";
    return {
      reply: String(parsed.reply || "Sono qui.").trim(),
      tone,
      offerClauria: Boolean(parsed.offerClauria),
      readyToStart: Boolean(parsed.readyToStart),
    };
  } catch {
    return {
      reply: "Sono qui. Quando vuoi, partiamo con calma.",
      tone: "neutral",
      offerClauria: false,
      readyToStart: false,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const messages: Msg[] = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (m: any) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .map((m: any) => ({
            role: m.role,
            content: String(m.content).slice(0, 1000),
          }))
          .slice(-12) // hard cap context
      : [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          reply: "",
          tone: "neutral",
          offerClauria: false,
          readyToStart: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await callAI(messages);

    // Privacy: NON salvare nulla. NON loggare contenuti.
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(
      "daily-opening-chat error:",
      e instanceof Error ? e.message : "unknown",
    );
    return new Response(
      JSON.stringify({
        reply: "Sono qui. Quando vuoi, partiamo con calma.",
        tone: "neutral",
        offerClauria: false,
        readyToStart: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
