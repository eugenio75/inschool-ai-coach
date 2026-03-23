import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userName, schoolLevel, lastSession, pendingHomework, emotionalHistory, upcomingTests } = await req.json();

    const toneMap: Record<string, string> = {
      alunno: "Tono caldo e giocoso ma non infantile. Frasi corte.",
      medie: "Tono amichevole e strutturato.",
      superiori: "Tono diretto e concreto, senza condiscendenza.",
      universitario: "Tono sobrio ed efficiente, da mentor a pari.",
      docente: "Tono collegiale, efficiente, preciso.",
    };

    const tone = toneMap[schoolLevel] || toneMap.superiori;

    const systemPrompt = `Sei il coach AI personale di ${userName} su InSchool.

Genera UN messaggio di apertura per la home. Max 2 frasi. Sempre una domanda finale aperta.

${tone}

REGOLE ASSOLUTE:
- MAI "Ciao! Come posso aiutarti oggi?" o saluti generici
- Usa i dati forniti per dire qualcosa di SPECIFICO e VERO
- Se non ci sono dati, sii comunque specifico sul momento della giornata

Output JSON: {"message":"...","suggestedAction":"testo bottone","actionRoute":"/percorso"}`;

    const context = `
Nome: ${userName}
Livello: ${schoolLevel}
Ultima sessione: ${lastSession ? JSON.stringify(lastSession) : "nessuna"}
Compiti in sospeso: ${pendingHomework ? JSON.stringify(pendingHomework) : "nessuno"}
Storico emotivo recente: ${emotionalHistory ? JSON.stringify(emotionalHistory) : "non disponibile"}
Verifiche imminenti: ${upcomingTests ? JSON.stringify(upcomingTests) : "nessuna"}
Ora attuale: ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
Giorno: ${new Date().toLocaleDateString("it-IT", { weekday: "long" })}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback
    return new Response(JSON.stringify({
      message: `Ciao ${userName}. Pronto per iniziare?`,
      suggestedAction: "Inizia a studiare",
      actionRoute: "/dashboard",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("coach-home-message error:", error);
    return new Response(JSON.stringify({
      message: "Bentornato. Da dove vuoi partire oggi?",
      suggestedAction: "Vai ai compiti",
      actionRoute: "/dashboard",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
