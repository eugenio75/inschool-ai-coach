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
      streak, teacherAssignments, urgentCount, gamification, lang, coachName,
    } = await req.json();

    const effectiveLang = lang || "it";
    const isEN = effectiveLang === "en";

    const pronoun = gender === "F" ? "a" : "o";

    const toneMap: Record<string, string> = isEN
      ? {
          alunno: "Warm and playful tone but not childish. Short sentences. Use simple analogies.",
          medie: "Friendly and structured tone. Encouraging but never condescending.",
          superiori: "Direct and concrete tone, no condescension. Focus on results.",
          universitario: "Sober and efficient tone, mentor to peer.",
          docente: "Collegial, efficient, precise tone.",
        }
      : {
          alunno: "Tono caldo e giocoso ma non infantile. Frasi corte. Usa analogie semplici.",
          medie: "Tono amichevole e strutturato. Incoraggiante ma mai condiscendente.",
          superiori: "Tono diretto e concreto, senza condiscendenza. Focus sui risultati.",
          universitario: "Tono sobrio ed efficiente, da mentor a pari.",
          docente: "Tono collegiale, efficiente, preciso.",
        };
    const tone = toneMap[schoolLevel] || (isEN ? toneMap.superiori : toneMap.superiori);

    let emotionalNote = "";
    if (recentEmotions?.length > 0) {
      const tones = recentEmotions.map((e: any) => e.emotional_tone).filter(Boolean);
      const negativeCount = tones.filter((t: string) => ["sad", "anxious", "frustrated", "angry"].includes(t)).length;
      const energyLevels = recentEmotions.map((e: any) => e.energy_level).filter(Boolean);
      const lowEnergy = energyLevels.filter((e: string) => e === "low").length;

      if (negativeCount >= 2) {
        emotionalNote = isEN
          ? `EMOTIONAL ATTENTION: ${userName} has shown signs of emotional difficulty in recent check-ins (${tones.join(", ")}). Be particularly welcoming and ask how they are WITHOUT pressure.`
          : `ATTENZIONE EMOTIVA: ${userName} ha mostrato segnali di difficoltà emotiva nei check-in recenti (${tones.join(", ")}). Sii particolarmente accogliente e chiedi come sta SENZA pressione.`;
      } else if (lowEnergy >= 2) {
        emotionalNote = isEN
          ? `NOTE: ${userName} has low energy lately. Suggest light and short activities, don't overload.`
          : `NOTA: ${userName} ha energia bassa ultimamente. Proponi attività leggere e brevi, non sovraccaricare.`;
      }
    }

    let errorsNote = "";
    if (recentErrors?.length > 0) {
      const subjects = [...new Set(recentErrors.map((e: any) => e.subject).filter(Boolean))];
      const errorTypes = [...new Set(recentErrors.map((e: any) => e.error_type).filter(Boolean))];
      errorsNote = isEN
        ? `RECENT UNRESOLVED ERRORS: ${recentErrors.length} errors in ${subjects.join(", ")}. Types: ${errorTypes.join(", ")}. If appropriate, suggest a targeted review.`
        : `ERRORI RECENTI NON RISOLTI: ${recentErrors.length} errori in ${subjects.join(", ")}. Tipi: ${errorTypes.join(", ")}. Se opportuno, suggerisci un ripasso mirato.`;
    }

    // ── Study tips ("trucchetti") — ~1/3 of the time ──
    const showTip = Math.random() < 0.33;
    const hasNegativeEmotion = recentEmotions?.length > 0 &&
      recentEmotions.filter((e: any) => ["sad", "anxious", "frustrated", "angry"].includes(e.emotional_tone)).length >= 2;
    const hasLowEnergy = recentEmotions?.length > 0 &&
      recentEmotions.some((e: any) => e.energy_level === "low");
    const hasLowTone = recentEmotions?.length > 0 &&
      recentEmotions.some((e: any) => e.emotional_tone === "low");
    const shouldShowTip = showTip && !hasNegativeEmotion;

    const tipLibrary = isEN
      ? `STUDY TIP LIBRARY (paraphrase and adapt to age/tone, never copy verbatim):
Oral subjects (history, literature, philosophy, science, geography):
- Repeat the concept aloud with eyes closed — the mind reconstructs without visual distractions
- Explain the topic as if teaching someone who knows nothing — where you get stuck, that's the gap
- After studying, wait 10 minutes and write everything you remember without looking at the book
- Walk while repeating — movement helps procedural memory
- Record your voice while explaining and listen back — you'll immediately hear what's missing
- Ask yourself questions: "Why did this happen? What would have changed if...?"

Written/math subjects (math, physics, chemistry, computer science):
- Before solving, read the text twice and underline only the data — not the text
- Solve the exercise without looking at the example, then compare. The mistake is more valuable than the solution
- Say the steps aloud while doing them — it slows thinking and prevents distraction errors
- After finishing, put down the pen and check with your eyes only — the brain finds errors better at rest
- Always estimate the result before calculating — you'll immediately notice if something is way off

Languages (English, Latin, Greek, second language):
- Read the word, cover it, write it, uncover — never look while writing
- Pair each new word with an absurd mental image — the stranger it is, the better you remember
- Read the text once normally, then reread looking only for grammar structures — double pass, double memory
- Write 3 of your own sentences using the new words — active production is worth 10 passive readings`
      : `LIBRERIA TRUCCHETTI DI STUDIO (parafrasa e adatta al tono/età, mai copiare letteralmente):
Materie orali (storia, letteratura, filosofia, scienze, geografia):
- Ripeti il concetto ad alta voce a occhi chiusi — la mente ricostruisce senza distrazioni visive
- Spiega l'argomento come se lo stessi insegnando a qualcuno che non sa niente — se ti blocchi, lì c'è il gap
- Dopo aver studiato, aspetta 10 minuti e scrivi tutto quello che ricordi senza guardare il libro
- Cammina mentre ripeti — il movimento aiuta la memoria procedurale
- Registra la tua voce mentre spieghi e riascoltati — sentirai subito cosa manca
- Fai domande a te stesso: "Perché è successo? Cosa sarebbe cambiato se...?"

Materie scritte/matematiche (matematica, fisica, chimica, informatica):
- Prima di risolvere, leggi il testo due volte e sottolinea solo i dati — non il testo
- Risolvi l'esercizio senza guardare l'esempio, poi confronta. L'errore è più prezioso della soluzione
- Scrivi i passaggi ad alta voce mentre li fai — rallenta il pensiero e previene errori di distrazione
- Dopo aver finito, metti giù la penna e controlla solo con gli occhi — il cervello trova gli errori meglio a riposo
- Stima sempre il risultato prima di calcolare — ti accorgi subito se hai sbagliato qualcosa di grosso

Lingue (inglese, latino, greco, seconda lingua):
- Leggi la parola, coprila, scrivi, scopri — non guardare mai mentre scrivi
- Abbina ogni parola nuova a un'immagine mentale assurda — più è strana, più la ricordi
- Rileggi il testo una volta normale, poi rileggilo cercando solo le strutture grammaticali — doppio passaggio, doppia memoria
- Scrivi 3 frasi tue usando le parole nuove — la produzione attiva vale 10 letture passive`;

    const tipInstruction = shouldShowTip
      ? (isEN
        ? `\n\nSTUDY TIP INSTRUCTION: At the END of your greeting (after the main message), add a brief study tip introduced naturally. Example: "Oh, a little trick for today: [tip]. Try it during your session!" Pick ONE tip from the library below that matches the student's pending subjects or recent sessions. The tip must feel spontaneous, like a friend sharing a secret — never mechanical. Max 2-3 sentences for the tip part.\n\n${tipLibrary}`
        : `\n\nISTRUZIONE TRUCCHETTO: Alla FINE del saluto (dopo il messaggio principale), aggiungi un breve trucchetto di studio introdotto in modo naturale. Esempio: "Ah, un piccolo trucco per oggi: [trucchetto]. Provaci durante la sessione!" Scegli UN trucchetto dalla libreria qui sotto che corrisponda alle materie o sessioni recenti dello studente. Il trucchetto deve sembrare spontaneo, come un amico che ti passa un segreto — mai meccanico. Max 2-3 frasi per la parte del trucchetto.\n\n${tipLibrary}`)
      : "";

    // ── Pensieri di Bene — ~1/4 of the time, naturally embedded ──
    const shouldShowPensiero = Math.random() < 0.25 && !hasNegativeEmotion && !hasLowEnergy && !hasLowTone;

    const pensieroPoolIT: Record<string, string[]> = {
      alunno: [
        "Sbagliare vuol dire che stai imparando.",
        "Ogni giorno sei un po' più grande di ieri.",
        "Chiedere aiuto è una cosa coraggiosa.",
        "Anche le cose difficili diventano facili se ci provi ogni giorno.",
        "Non importa chi finisce prima. Importa che tu faccia del tuo meglio.",
      ],
      medie: [
        "Non confrontarti con gli altri. Confrontati con chi eri ieri.",
        "La fatica di oggi è la forza di domani.",
        "La curiosità è il motore di tutto. Tienila accesa.",
        "Chiedere aiuto non è debolezza — è intelligenza.",
        "Il talento si allena. La gentilezza si sceglie.",
      ],
      superiori: [
        "Non è importante cadere. È importante rialzarsi.",
        "Il tuo valore non dipende dai tuoi voti.",
        "Fare la cosa giusta quando è difficile — questo si chiama carattere.",
        "Un piccolo passo ogni giorno porta lontano.",
        "Sbagliare fa parte dell'imparare. Chi non sbaglia non sta provando abbastanza.",
      ],
      universitario: [
        "La vera intelligenza è sapere quello che non sai.",
        "Il successo misura i risultati. Il carattere misura come li hai ottenuti.",
        "La conoscenza senza saggezza è potere senza direzione.",
        "Impara a stare con il disagio — è lì che avviene la crescita vera.",
        "Tratta ogni persona come se avesse qualcosa da insegnarti. Di solito ce l'ha.",
      ],
    };
    const pensieroPoolEN: Record<string, string[]> = {
      alunno: [
        "Making mistakes means you're learning.",
        "Every day you're a little bigger than yesterday.",
        "Asking for help is a brave thing.",
        "Even hard things become easy if you try every day.",
        "It doesn't matter who finishes first. What matters is that you do your best.",
      ],
      medie: [
        "Don't compare yourself to others. Compare yourself to who you were yesterday.",
        "Today's effort is tomorrow's strength.",
        "Curiosity drives everything. Keep it alive.",
        "Asking for help isn't weakness — it's intelligence.",
        "Talent is trained. Kindness is chosen.",
      ],
      superiori: [
        "Falling isn't what matters. Getting back up is.",
        "Your worth doesn't depend on your grades.",
        "Doing the right thing when it's hard — that's called character.",
        "A small step every day takes you far.",
        "Making mistakes is part of learning. If you're not making mistakes, you're not trying hard enough.",
      ],
      universitario: [
        "True intelligence is knowing what you don't know.",
        "Success measures results. Character measures how you got them.",
        "Knowledge without wisdom is power without direction.",
        "Learn to sit with discomfort — that's where real growth happens.",
        "Treat every person as if they have something to teach you. They usually do.",
      ],
    };

    let pensieroInstruction = "";
    if (shouldShowPensiero) {
      const pool = isEN
        ? (pensieroPoolEN[schoolLevel] || pensieroPoolEN.superiori)
        : (pensieroPoolIT[schoolLevel] || pensieroPoolIT.superiori);
      const dayIndex = new Date().getDate();
      const thought = pool[dayIndex % pool.length];
      const connectors = isEN
        ? ["Oh, one thing:", "Before we start:", "Thought for today:"]
        : ["Ah, una cosa:", "Prima di iniziare:", "Pensiero per oggi:"];
      const connector = connectors[dayIndex % connectors.length];

      pensieroInstruction = isEN
        ? `\n\nPENSIERO DI BENE INSTRUCTION: At the very end of your message, add this thought as a natural final sentence — not a separate block, not a card. Introduce it with "${connector}" and then this thought: "${thought}". It must feel like a friend sharing a genuine reflection.`
        : `\n\nISTRUZIONE PENSIERO DI BENE: Alla fine del tuo messaggio, aggiungi questo pensiero come ultima frase naturale — non un blocco separato, non una card. Introducilo con "${connector}" e poi questo pensiero: "${thought}". Deve sembrare un amico che condivide una riflessione genuina.`;
    }

    const recognitionRule = isEN
      ? `\n\n[RECOGNITION PRINCIPLE — mandatory] Every time you mention ${userName} or describe a situation, lead with RECOGNITION (what they ARE doing/trying), then name the OBSTACLE without judgment, then propose ACTION. Never open with a deficit or judgment. Tone of a trusted friend who sees both effort and struggle.`
      : `\n\n[PRINCIPIO DEL RICONOSCIMENTO — obbligatorio] Ogni volta che nomini ${userName} o descrivi una situazione, parti dal RICONOSCIMENTO (cosa STA facendo/provando), poi nomina l'OSTACOLO senza giudizio, poi proponi l'AZIONE. MAI aprire con un deficit o un giudizio. Tono di un amico fidato che vede sia l'impegno sia la fatica.`;

    const coachLabel = coachName || (isEN ? "your coach" : "il tuo coach");
    const systemPrompt = isEN
      ? `You are ${coachLabel}, ${userName}'s personal coach on SarAI. You are a trusted companion — you know ${userName}, remember their sessions, progress and difficulties. You're not a psychologist, you're an attentive friend who notices how the other person is doing. Never refer to yourself as "AI", "artificial intelligence" or similar technical terms — you are simply a coach with a name.${recognitionRule}

Generate ONE opening message for the home. Max 2-3 sentences.

MESSAGE STRUCTURE (mandatory):
1. FIRST SENTENCE: show you care about how ${userName} is doing in a natural, non-clinical way. Don't ask "how are you?" generically. Use context: if it's Monday morning "New Monday, how's it going?", if it's late "You're here at this hour, long day?", if they have low energy "Hey, you seem a bit tired — no worries", if streak is high "You're on fire!". Be genuine, like a friend would.
2. SECOND SENTENCE: concrete suggestion based on data (homework, errors, review).
3. End with a question or open proposal.

${tone}

${emotionalNote}
${errorsNote}

ABSOLUTE RULES:
- NEVER clinical greetings like "How do you feel today?" or "How are you emotionally?"
- NEVER generic greetings like "Hi! How can I help you?"
- The emotional tone must be NATURAL: like a friend who notices, not a psychologist who investigates
- Use the provided data to say something SPECIFIC and TRUE about ${userName}
- If emotional state is negative, prioritize well-being — suggest something light, never pressure
- If there are urgent tasks but low mood, acknowledge the mood first then suggest lightly
- If there's a streak, briefly acknowledge it
- If there are teacher assignments, mention them
- Be human and warm, never robotic
- ALWAYS respond in English
${tipInstruction}
${pensieroInstruction}

Output JSON: {"message":"...","suggestedAction":"button text","actionRoute":"/path"}

Available routes (VERY IMPORTANT — use subject parameter when specifying a subject):
- /us?type=guided&hw=ID (guided session on a specific task)
- /us?type=study&subject=Mathematics (free study on specific subject)
- /us?type=review&subject=Mathematics (review on specific subject)
- /prep/Mathematics (test prep on specific subject)
- /study-tasks (student's task list)
- /add-homework (add homework)
- /memory (memory and review)
- /flashcards?subject=Mathematics (flashcards on specific subject)

ROUTE RULE: when suggesting an action on a specific subject, ALWAYS include &subject=SubjectName in the route.`
      : `Sei ${coachLabel}, il coach personale di ${userName} su SarAI. Sei un compagno fidato — conosci ${userName}, ricordi le sue sessioni, i suoi progressi e le sue difficoltà. Non sei uno psicologo, sei un amico attento che si accorge di come sta l'altro. Non riferirti mai a te stesso come "AI", "intelligenza artificiale" o termini tecnici simili — sei semplicemente un coach con un nome.${recognitionRule}

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
${tipInstruction}
${pensieroInstruction}

Output JSON: {"message":"...","suggestedAction":"testo bottone","actionRoute":"/percorso"}

Route disponibili (IMPORTANTISSIMO — usa il parametro subject quando specifichi una materia):
- /us?type=guided&hw=ID (sessione guidata su un compito specifico)
- /us?type=study&subject=Matematica (studio libero su materia specifica)
- /us?type=review&subject=Matematica (ripasso su materia specifica)
- /prep/Matematica (preparazione verifica su materia specifica)
- /study-tasks (lista compiti dello studente)
- /add-homework (aggiungi compiti)
- /memory (memoria e ripasso)
- /flashcards?subject=Matematica (flashcard su materia specifica)

REGOLA ROUTE: quando suggerisci un'azione su una materia specifica, SEMPRE includere &subject=NomeMateria nella route.`;

    const context = isEN
      ? `
Name: ${userName}
Gender: ${gender || "not specified"}
Level: ${schoolLevel}
Current streak: ${streak || 0} consecutive days
Gamification: ${gamification ? JSON.stringify(gamification) : "not available"}
Urgent tasks (today/tomorrow): ${urgentCount || 0}
Pending homework: ${pendingHomework?.length ? JSON.stringify(pendingHomework) : "none"}
Recent sessions: ${recentSessions?.length ? JSON.stringify(recentSessions) : "none"}
Teacher assignments: ${teacherAssignments?.length ? JSON.stringify(teacherAssignments) : "none"}
Recent emotional check-ins: ${recentEmotions?.length ? JSON.stringify(recentEmotions) : "none"}
Unresolved learning errors: ${recentErrors?.length ? JSON.stringify(recentErrors) : "none"}
Time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
Day: ${new Date().toLocaleDateString("en-US", { weekday: "long" })}`
      : `
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      message: isEN
        ? `Hi ${userName}! I'm here for you. Where would you like to start?`
        : `Ciao ${userName}! Sono qui per te. Da dove vuoi partire?`,
      suggestedAction: isEN ? "Start studying" : "Inizia a studiare",
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
