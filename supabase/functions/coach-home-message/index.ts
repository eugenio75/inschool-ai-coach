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
      userName, schoolLevel, gender, lastSession, pendingHomework,
      recentEmotions, recentErrors, recentSessions,
      streak, teacherAssignments, urgentCount, gamification,
    } = await req.json();

    const pronoun = gender === "F" ? "a" : "o";
    const toneMap: Record<string, string> = {
      alunno: "Tono caldo e giocoso ma non infantile. Frasi corte. Usa analogie semplici.",
      medie: "Tono amichevole e strutturato. Incoraggiante ma mai condiscendente.",
      superiori: "Tono diretto e concreto, senza condiscendenza. Focus sui risultati.",
      universitario: "Tono sobrio ed efficiente, da mentor a pari.",
      docente: "Tono collegiale, efficiente, preciso.",
    };
    const tone = toneMap[schoolLevel] || toneMap.superiori;

    // Analyze emotional patterns
    let emotionalNote = "";
    if (recentEmotions?.length > 0) {
      const tones = recentEmotions.map((e: any) => e.emotional_tone).filter(Boolean);
      const negativeCount = tones.filter((t: string) => ["sad", "anxious", "frustrated", "angry"].includes(t)).length;
      const energyLevels = recentEmotions.map((e: any) => e.energy_level).filter(Boolean);
      const lowEnergy = energyLevels.filter((e: string) => e === "low").length;

      if (negativeCount >= 2) {
        emotionalNote = `ATTENZIONE EMOTIVA: ${userName} ha mostrato segnali di difficoltà emotiva nei check-in recenti (${tones.join(", ")}). Sii particolarmente accogliente e chiedi come sta SENZA pressione.`;
      } else if (lowEnergy >= 2) {
        emotionalNote = `NOTA: ${userName} ha energia bassa ultimamente. Proponi attività leggere e brevi, non sovraccaricare.`;
      }
    }

    // Analyze learning errors
    let errorsNote = "";
    if (recentErrors?.length > 0) {
      const subjects = [...new Set(recentErrors.map((e: any) => e.subject).filter(Boolean))];
      const errorTypes = [...new Set(recentErrors.map((e: any) => e.error_type).filter(Boolean))];
      errorsNote = `ERRORI RECENTI NON RISOLTI: ${recentErrors.length} errori in ${subjects.join(", ")}. Tipi: ${errorTypes.join(", ")}. Se opportuno, suggerisci un ripasso mirato.`;
    }

    const systemPrompt = `Sei il coach AI personale di ${userName} su InSchool. Sei un compagno fidato — conosci ${userName}, ricordi le sue sessioni, i suoi progressi e le sue difficoltà. Non sei uno psicologo, sei un amico attento che si accorge di come sta l'altro.

Genera UN messaggio di apertura per la home. Max 2-3 frasi.

STRUTTURA DEL MESSAGGIO (obbligatoria):
1. PRIMA FRASE: mostra che ti importa di come sta ${userName} in modo naturale e non clinico. Non chiedere "come stai?" in modo generico. Usa il contesto: se è lunedì mattina "Nuovo lunedì, come parte?", se è tardi "Arrivi a quest'ora, giornata lunga?", se ha energia bassa ultimamente "Ehi, ti vedo un po' scaric${pronoun} — niente paura", se ha streak alta "Sei in forma!". Sii genuino, come farebbe un amico.
2. SECONDA FRASE: proposta concreta basata sui dati (compiti, errori, ripasso).
3. Termina con domanda o proposta aperta.

${tone}
Declina al ${gender === "F" ? "femminile" : "maschile"} (es. "pront${pronoun}", "brav${pronoun}").

${emotionalNote}
${errorsNote}

REGOLE ASSOLUTE:
- MAI saluti clinici tipo "Come ti senti oggi?" o "Come stai emotivamente?"
- MAI saluti generici tipo "Ciao! Come posso aiutarti?"
- Il tono emotivo deve essere NATURALE: come un amico che si accorge, non uno psicologo che indaga
- Usa i dati forniti per dire qualcosa di SPECIFICO e VERO su ${userName}
- Se lo stato emotivo è negativo, priorità al benessere — proponi qualcosa di leggero, mai pressione
- Se ci sono compiti urgenti ma umore basso, riconosci prima l'umore poi proponi con leggerezza
- Se c'è streak, riconoscilo brevemente
- Se ci sono assegnazioni dal professore, segnalale
- Sii umano e caldo, mai robotico

Output JSON: {"message":"...","suggestedAction":"testo bottone","actionRoute":"/percorso"}

Route disponibili (IMPORTANTISSIMO — usa il parametro subject quando specifichi una materia):
- /us?type=guided&hw=ID (sessione guidata su un compito specifico)
- /us?type=study&subject=Matematica (studio libero su materia specifica)
- /us?type=review&subject=Matematica (ripasso su materia specifica)
- /us?type=prep&subject=Matematica (preparazione verifica su materia specifica)
- /study-tasks (lista compiti dello studente)
- /add-homework (aggiungi compiti)
- /memory (memoria e ripasso)
- /flashcards?subject=Matematica (flashcard su materia specifica)

REGOLA ROUTE: quando suggerisci un'azione su una materia specifica, SEMPRE includere &subject=NomeMateria nella route.`;

    const context = `
Nome: ${userName}
Genere: ${gender || "non specificato"}
Livello: ${schoolLevel}
Streak attuale: ${streak || 0} giorni consecutivi
Gamification: ${gamification ? JSON.stringify(gamification) : "non disponibile"}
Compiti urgenti (oggi/domani): ${urgentCount || 0}
Compiti in sospeso: ${pendingHomework?.length ? JSON.stringify(pendingHomework) : "nessuno"}
Ultime sessioni: ${recentSessions?.length ? JSON.stringify(recentSessions) : "nessuna"}
Assegnazioni dal professore: ${teacherAssignments?.length ? JSON.stringify(teacherAssignments) : "nessuna"}
Check-in emotivi recenti: ${recentEmotions?.length ? JSON.stringify(recentEmotions) : "nessuno"}
Errori di apprendimento non risolti: ${recentErrors?.length ? JSON.stringify(recentErrors) : "nessuno"}
Ora: ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
Giorno: ${new Date().toLocaleDateString("it-IT", { weekday: "long" })}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      message: `Ciao ${userName}! Sono qui per te. Da dove vuoi partire?`,
      suggestedAction: "Inizia a studiare",
      actionRoute: "/us?type=study",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("coach-home-message error:", error);
    return new Response(JSON.stringify({
      message: "Bentornato. Sono qui — da dove vuoi partire oggi?",
      suggestedAction: "Vai ai compiti",
      actionRoute: "/dashboard",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
