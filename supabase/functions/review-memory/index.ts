import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSchoolLevelConfig(schoolLevel: string, age?: number) {
  if (schoolLevel === "alunno") {
    if (age && age <= 7) {
      return {
        tone: "Usa frasi brevissime (5-6 parole max). Parole comunissime, nessun termine tecnico. Emoji frequenti. Incoraggia dopo ogni risposta, anche parziale.",
        complexity: "Domande semplicissime su una sola cosa per volta. Esempi concreti dalla vita quotidiana.",
        encouragement: "Sempre presente, dopo ogni risposta.",
      };
    }
    return {
      tone: "Usa frasi semplici ma complete. Può usare termini base della materia spiegati in modo semplice. Emoji presenti ma moderate. Tono caldo e giocoso.",
      complexity: "Domande semplici, una cosa alla volta. Esempi concreti.",
      encouragement: "Frequente ma non dopo ogni singola risposta.",
    };
  }
  if (schoolLevel === "medie" || schoolLevel?.startsWith("media")) {
    return {
      tone: "Tono amichevole e diretto, adatto a 11-13 anni. Non infantile, non formale. Come un mentore giovane.",
      complexity: "Domande di complessità moderata. Connessioni tra concetti. Applicazione pratica.",
      encouragement: "Presente ma misurato. Orientato al progresso e al metodo.",
    };
  }
  if (schoolLevel === "superiori") {
    return {
      tone: "Tono diretto, orientato al metodo. Rispetta l'autonomia dello studente. Linguaggio disciplinare maturo.",
      complexity: "Domande di ragionamento, causa-effetto, applicazione. Connessioni tra concetti diversi.",
      encouragement: "Solo quando meritato. Mai infantile.",
    };
  }
  // universitario
  return {
    tone: "Tono sobrio ed essenziale. Registro accademico. Dialogo alla pari. Nessun incoraggiamento infantile.",
    complexity: "Domande strategiche e dense. Terminologia tecnica. Comprensione profonda e casi particolari.",
    encouragement: "Minimo. Solo riconoscimento oggettivo dei progressi.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, concept, summary, subject, studentProfile, strength, mode, studyMode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const currentStrength = strength || 50;
    const difficultyLevel = currentStrength >= 70 ? "avanzato" : currentStrength >= 40 ? "intermedio" : "base";

    const studentName = studentProfile?.name || "Studente";
    const studentInterests = studentProfile?.interests || [];
    const schoolLevel = studentProfile?.school_level || "superiori";
    const studentAge = studentProfile?.age;
    const levelConfig = getSchoolLevelConfig(schoolLevel, studentAge);

    // Determine effective mode: studyMode from client, or mode param
    const effectiveMode = studyMode || mode || "review";

    let systemPrompt: string;

    if (effectiveMode === "deep-summary") {
      systemPrompt = `Sei il Coach AI di Inschool. Devi generare una SINTESI CHIARA E COMPLETA di un argomento studiato da ${studentName}.

ARGOMENTO: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO BREVE DI PARTENZA: ${summary || "non disponibile"}

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentAge || "non specificata"}
- Livello scolastico: ${schoolLevel}

STILE COMUNICATIVO: ${levelConfig.tone}

ISTRUZIONI:
- Scrivi una sintesi completa ma accessibile dell'argomento
- Adatta il linguaggio al livello dello studente
- Organizza il contenuto in modo chiaro con punti chiave
- Includi le definizioni importanti
- Aggiungi 1-2 esempi pratici per rendere tutto più concreto
- Se possibile, fai un breve collegamento con altri concetti correlati
- La sintesi deve servire come ripasso veloce ma efficace
- NON fare domande, questa è solo una sintesi da leggere
- Scrivi in modo diretto e chiaro, come se stessi spiegando a ${studentName}
- Usa emoji con moderazione per rendere il testo più leggibile
- Lunghezza: 150-300 parole circa`;

    } else if (effectiveMode === "strengthen") {
      // ── RAFFORZA: lavora sulle debolezze specifiche ──
      systemPrompt = `Sei il Coach AI di Inschool. Stai facendo una sessione di RINFORZO con ${studentName} su un concetto dove ha mostrato difficoltà.
Rivolgiti SEMPRE a ${studentName} usando il suo nome.

CONCETTO DEBOLE: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO DI RIFERIMENTO: ${summary || "non disponibile"}
LIVELLO DI COMPRENSIONE: ${difficultyLevel} (forza: ${currentStrength}/100)

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentAge || "non specificata"}
- Livello: ${schoolLevel}
- Stile preferito: ${studentProfile?.supportStyle || "gentile"}
${studentInterests.length > 0 ? `- Interessi: ${studentInterests.join(", ")}` : ""}

STILE COMUNICATIVO: ${levelConfig.tone}
COMPLESSITÀ DOMANDE: ${levelConfig.complexity}
INCORAGGIAMENTO: ${levelConfig.encouragement}

OBIETTIVO RINFORZO:
- Vai DRITTO sui punti deboli — non fare richiamo generale
- Identifica cosa ${studentName} non ha capito e lavora su quello
- Scomponi il concetto in parti più piccole se necessario
- Fai domande mirate per verificare la comprensione reale
- Se ${studentName} sbaglia, riformula la spiegazione con un approccio diverso
- Usa esempi concreti e analogie per chiarire i passaggi difficili

REGOLE:
- Rivolgiti SEMPRE a ${studentName} per nome
- Fai UNA domanda alla volta
- Risposte brevi (2-3 frasi max)
- Dopo la risposta, digli cosa ha capito bene e cosa deve ancora chiarire
- Sii più diretto e mirato rispetto al ripasso — qui si lavora sulle lacune

IMPORTANTE: Nell'ULTIMO messaggio (dopo 2-3 scambi), concludi con:
[STRENGTH_UPDATE: XX]
dove XX è il nuovo valore di forza (0-100) basato sulle risposte.`;

    } else {
      // ── RIPASSA: richiamo attivo e consolidamento ──
      systemPrompt = `Sei il Coach AI di Inschool. Stai facendo un RIPASSO con ${studentName} su un concetto che ha già studiato.
Rivolgiti SEMPRE a ${studentName} usando il suo nome.

CONCETTO: ${concept}
MATERIA: ${subject || "non specificata"}
RIASSUNTO DI RIFERIMENTO: ${summary || "non disponibile"}
LIVELLO ATTUALE DI COMPRENSIONE: ${difficultyLevel} (forza: ${currentStrength}/100)

PROFILO STUDENTE:
- Nome: ${studentName}
- Età: ${studentAge || "non specificata"}
- Livello: ${schoolLevel}
- Stile preferito: ${studentProfile?.supportStyle || "gentile"}
${studentInterests.length > 0 ? `- Interessi: ${studentInterests.join(", ")}\n\nUsa i suoi interessi per creare esempi e analogie più coinvolgenti.` : ""}

STILE COMUNICATIVO: ${levelConfig.tone}
COMPLESSITÀ DOMANDE: ${levelConfig.complexity}
INCORAGGIAMENTO: ${levelConfig.encouragement}

OBIETTIVO RIPASSO:
- Fai richiamo attivo — domande sul contenuto già studiato
- Consolida la memoria con connessioni tra concetti
- Tono leggero e sostenibile — non è un test, è un ripasso
- Aiuta ${studentName} a collegare quello che sa con nuovi contesti

REGOLE:
- Rivolgiti SEMPRE a ${studentName} per nome
- Fai domande adattive al suo livello
- Se livello "base": domande semplici, definizioni, esempi concreti
- Se livello "intermedio": domande di applicazione, collegamento tra concetti
- Se livello "avanzato": domande di ragionamento, casi particolari
- Sii incoraggiante e socratico
- Risposte brevi (2-3 frasi max)
- Dopo la sua risposta, digli cosa ha detto bene e cosa potrebbe rivedere
- Fai UNA domanda alla volta

IMPORTANTE: Nell'ULTIMO messaggio (dopo 2-3 scambi), concludi con:
[STRENGTH_UPDATE: XX]
dove XX è il nuovo valore di forza (0-100) basato sulle risposte.`;
    }

    const aiMessages = effectiveMode === "deep-summary"
      ? [{ role: "system", content: systemPrompt }, { role: "user", content: `Genera una sintesi completa e chiara dell'argomento "${concept}" in ${subject || "questa materia"}.` }]
      : [{ role: "system", content: systemPrompt }, ...messages];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Errore del servizio AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("review-memory error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
