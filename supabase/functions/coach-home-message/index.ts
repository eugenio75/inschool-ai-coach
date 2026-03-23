import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      userName, schoolLevel, lastSession, pendingHomework,
      emotionalHistory, upcomingTests,
      streak, lastActivityDate, teacherAssignments
    } = await req.json();

    const toneMap: Record<string, string> = {
      alunno: "Tono caldo e giocoso ma non infantile. Frasi corte. Usa il 'tu'.",
      medie: "Tono amichevole e strutturato.",
      superiori: "Tono diretto e concreto, senza condiscendenza.",
      universitario: "Tono sobrio ed efficiente, da mentor a pari.",
      docente: "Tono collegiale, efficiente, preciso.",
    };

    const tone = toneMap[schoolLevel] || toneMap.alunno;

    const systemPrompt = `Sei il coach AI personale di ${userName} su InSchool.

Genera UN messaggio di apertura per la home. Max 2 frasi. Sempre una domanda finale aperta che invita all'azione.

${tone}

SCENARI DA COPRIRE (usa il più rilevante in base ai dati):
1. Compiti urgenti (scadenza oggi/domani): "Oggi hai N cose. Ti aiuto a partire dalla più gestibile."
2. Ha studiato bene ieri (lastSession recente): "Ieri hai fatto un ottimo lavoro. Continuiamo da dove ci eravamo fermati."
3. Fermo da giorni (streak=0 o lastActivityDate vecchia): "Bentornato. Partiamo da un passo piccolo, non da tutto."
4. Verifica imminente: "Domani hai la verifica di [materia]. Vuoi fare un ripasso adesso?"
5. Compito docente non aperto (teacherAssignments non vuoto): "Il tuo professore ha assegnato qualcosa di nuovo. Lo vediamo insieme?"
6. Stato emotivo negativo: adatta il tono per essere più rassicurante.

REGOLE ASSOLUTE:
- MAI "Ciao! Come posso aiutarti oggi?" o saluti generici
- Usa i dati forniti per dire qualcosa di SPECIFICO e VERO
- Non usare emoji
- Se non ci sono dati significativi, basati sul momento della giornata e lo streak

Output JSON: {"message":"...","suggestedAction":"testo bottone","actionRoute":"/percorso"}

suggestedAction deve essere un testo breve per un bottone (es. "Inizia", "Ripassa matematica", "Vedi compito").
actionRoute deve essere un percorso valido: /homework/[id], /memory, /challenge/new, /add-homework.`;

    const homeworkSummary = (pendingHomework || []).map((h: any) => {
      const parts = [h.subject, h.title];
      if (h.due_date) {
        const d = new Date(h.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (days <= 0) parts.push("SCADE OGGI");
        else if (days === 1) parts.push("scade domani");
        else parts.push(`scade tra ${days} giorni`);
      }
      return parts.join(" - ");
    }).join("\n");

    const teacherSummary = (teacherAssignments || []).map((a: any) =>
      `${a.type}: ${a.title}${a.subject ? ` (${a.subject})` : ""}`
    ).join("\n");

    // Calculate days since last activity
    let daysSinceActivity = null;
    if (lastActivityDate) {
      const last = new Date(lastActivityDate);
      const today = new Date();
      last.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      daysSinceActivity = Math.ceil((today.getTime() - last.getTime()) / 86400000);
    }

    const context = `
Nome: ${userName}
Livello: ${schoolLevel}
Streak attuale: ${streak || 0} giorni consecutivi
Giorni dall'ultima attività: ${daysSinceActivity !== null ? daysSinceActivity : "sconosciuto"}
Ultima sessione completata: ${lastSession ? JSON.stringify(lastSession) : "nessuna"}
Compiti in sospeso (${(pendingHomework || []).length}):
${homeworkSummary || "nessuno"}
Assegnazioni docente non aperte (${(teacherAssignments || []).length}):
${teacherSummary || "nessuna"}
Check-in emotivo di oggi: ${emotionalHistory ? `tono: ${emotionalHistory.emotional_tone}, energia: ${emotionalHistory.energy_level}, segnali: ${(emotionalHistory.signals || []).join(", ")}` : "non fatto"}
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
        temperature: 0.7,
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
