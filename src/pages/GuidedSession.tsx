import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Send, Lightbulb, AlertCircle, Loader2, Paperclip, Mic, RefreshCw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionCelebration } from "@/components/SessionCelebration";
import { playCelebrationSound } from "@/lib/celebrationSound";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentLang } from "@/lib/langUtils";
import { useAuth } from "@/hooks/useAuth";
import { MathText } from "@/components/shared/MathText";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export default function GuidedSession() {
  const navigate = useNavigate();
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const { user } = useAuth();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";

  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [emotionalCheckin, setEmotionalCheckin] = useState<string | null>(null);
  const [showExplainOptions, setShowExplainOptions] = useState(false);
  const [needsContent, setNeedsContent] = useState(false);
  const [manualContent, setManualContent] = useState("");
  const [overrideContent, setOverrideContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper: extract only the section of full_ocr_text that matches the homework title.
  // The OCR pipeline often returns a multi-exercise PDF chunked as:
  //   [Parte N: <title>]\n<body>\n---\n[Parte N+1: ...]
  // If we pass the entire blob to the coach, it mixes measurements between exercises
  // (e.g. takes "3 rotoli da 10 metri" from a different problem). We must isolate only
  // the section whose [Parte N: ...] header matches our homework title.
  function extractRelevantSection(fullText: string, title: string): string {
    if (!fullText) return "";
    // Split on the "[Parte N: ..." markers, keeping the headers
    const parts = fullText.split(/(?=\[Parte\s+\d+:)/gi).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) return fullText; // no markers — return as-is

    // Normalize for matching: strip diacritics, collapse spaces, lowercase
    const norm = (s: string) =>
      s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const titleNorm = norm(title);
    // Try a strict header match first: "[Parte N: <title>]"
    for (const part of parts) {
      const headerMatch = part.match(/^\[Parte\s+\d+:\s*([^\]]+)\]/i);
      if (!headerMatch) continue;
      const sectionTitle = norm(headerMatch[1]);
      if (sectionTitle === titleNorm || sectionTitle.includes(titleNorm) || titleNorm.includes(sectionTitle)) {
        return part.replace(/^---\s*$/gm, "").trim();
      }
    }
    // Fallback: find the part whose body contains the most title keywords
    const titleWords = titleNorm.split(" ").filter(w => w.length >= 3);
    if (titleWords.length === 0) return fullText;
    let best = parts[0];
    let bestScore = -1;
    for (const part of parts) {
      const partNorm = norm(part);
      const score = titleWords.reduce((acc, w) => acc + (partNorm.includes(w) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = part; }
    }
    return best.replace(/^---\s*$/gm, "").trim();
  }

  // Helper: build the homework content string from DB fields or manual override
  const getHomeworkContent = useCallback((hw: any): string => {
    if (overrideContent) return overrideContent;
    const fullOcr = hw?.source_files?.[0]?.full_ocr_text || "";
    if (fullOcr) {
      const isolated = extractRelevantSection(fullOcr, hw?.title || "");
      if (isolated && isolated.length >= 20) return isolated;
    }
    return hw?.description || hw?.title || "";
  }, [overrideContent]);

  const buildInitialContentMessage = (hw: any): string => {
    const studentName = profile?.name ? ` ${profile.name}` : "";
    const content = getHomeworkContent(hw).trim();
    const clipped = content.length > 2200 ? `${content.slice(0, 2200).trim()}\n[…]` : content;

    return `Ciao${studentName}! Ho davanti questo compito:\n\n«${clipped}»\n\nConfermi che il testo è questo? Se qualcosa non torna, fermami subito.`;
  };

  const looksLikeChallenge = (value: string): boolean => {
    const normalized = value.toLowerCase().trim();
    return /\b(ma cosa dici|cosa dici|non è così|non e così|sbagli|hai sbagliato|no|non torna|non va bene|aspetta)\b/.test(normalized);
  };

  const userId = user?.id || getChildSession()?.profileId;

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Load homework and check for existing session
  useEffect(() => {
    if (!homeworkId) return;
    loadSession();
  }, [homeworkId]);

  async function loadSession() {
    setLoading(true);
    try {
      // Load homework
      const { data: hw } = await supabase
        .from("homework_tasks")
        .select("*")
        .eq("id", homeworkId!)
        .single();
      if (!hw) { navigate("/dashboard"); return; }
      setHomework(hw);

      // Check for existing paused session
      const { data: existing } = await supabase
        .from("guided_sessions")
        .select("*")
        .eq("homework_id", homeworkId!)
        .eq("status", "paused")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        // Resume
        const sess = existing[0];
        setSessionId(sess.id);
        setCurrentStep(sess.current_step || 1);
        setTotalSteps(sess.total_steps || 0);

        // Load steps
        const { data: savedSteps } = await supabase
          .from("study_steps")
          .select("*")
          .eq("session_id", sess.id)
          .order("step_number", { ascending: true });
        setSteps(savedSteps || []);

        // Resume message
        const resumeMsg = sess.last_difficulty
          ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}. Riprendiamo dallo step ${sess.current_step}.`
          : `Bentornato! Ripartiamo dallo step ${sess.current_step}.`;
        setMessages([{ role: "assistant", content: resumeMsg }]);
        setLoading(false);
      } else {
        // Gate: require homework content before opening the coach.
        // Use the SAME isolation logic the coach will see, so a multi-exercise
        // PDF with a tiny D24 section still validates against the section length.
        const content = getHomeworkContent(hw);
        if (!content || content.trim().length < 80) {
          setNeedsContent(true);
          setManualContent(hw?.description || hw?.title || "");
          setLoading(false);
          return;
        }
        // New session — start directly (daily opening moment is handled at app entry)
        startNewSession("neutro");
      }
    } catch (err) {
      console.error("loadSession error:", err);
      setLoading(false);
    }
  }

  async function startNewSession(emotion: string) {
    setEmotionalCheckin(emotion);
    setLoading(true);

    try {
      // Generate steps via edge function
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-steps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            homeworkTitle: homework.title,
            homeworkType: homework.task_type,
            subject: homework.subject,
            schoolLevel,
            description: getHomeworkContent(homework) || homework.description,
            lang: getCurrentLang(),
          }),
        }
      );

      let generatedSteps: any[] = [];
      if (res.ok) {
        const result = await res.json();
        generatedSteps = result.steps || [];
      }

      if (generatedSteps.length === 0) {
        generatedSteps = [
          { number: 1, text: "Cosa sai già su questo argomento? Descrivilo con parole tue.", bloomLevel: 1 },
          { number: 2, text: "Quali sono le parti principali di questo compito?", bloomLevel: 2 },
          { number: 3, text: "Prova a risolvere il primo punto — cosa noti?", bloomLevel: 3 },
        ];
      }

      setTotalSteps(generatedSteps.length);

      // Create guided_session
      const { data: newSession } = await supabase
        .from("guided_sessions")
        .insert({
          user_id: userId,
          homework_id: homeworkId,
          status: "active",
          current_step: 1,
          total_steps: generatedSteps.length,
          emotional_checkin: emotion,
        })
        .select()
        .single();

      if (!newSession) throw new Error("Failed to create session");
      setSessionId(newSession.id);

      // Save steps
      const stepRows = generatedSteps.map((s: any) => ({
        user_id: userId,
        homework_id: homeworkId,
        session_id: newSession.id,
        step_number: s.number,
        step_text: s.text,
        status: s.number === 1 ? "active" : "pending",
      }));

      await supabase.from("study_steps").insert(stepRows);
      setSteps(generatedSteps);
      setCurrentStep(1);

      // Opening: ask the coach to confirm the homework content (RULE 0).
      // The coach reads `extracted_content` from the system prompt of sendMessage.
      // We trigger the first turn by sending a hidden init message.
      setMessages([]);
      setCurrentStep(1);
      setLoading(false);
      // Defer to next tick so state is committed before sendMessage reads it
      setTimeout(() => {
        sendMessage("__INIT_CONFIRM_CONTENT__", { hideUser: true, isInit: true });
      }, 50);
      return;
    } catch (err) {
      console.error("startNewSession error:", err);
      setMessages([{ role: "assistant", content: "Si è verificato un errore nell'avvio della sessione. Riprova." }]);
    }
    setLoading(false);
  }

  async function sendMessage(text?: string, opts?: { hideUser?: boolean; isInit?: boolean }) {
    const isInit = opts?.isInit === true;
    const hideUser = opts?.hideUser === true;
    const msgText = text || input.trim();
    if (!msgText || sending) return;

    const userMsg: ChatMessage = { role: "user", content: msgText };
    // For the init turn, do NOT show the seed user message in the UI history,
    // but DO send it to the model so it produces the first assistant message.
    const newMessages = [...messages, userMsg];
    if (!hideUser) {
      setMessages(newMessages);
    }
    setInput("");
    setSending(true);
    setStreamingText("");

    try {
      const currentStepData = steps[currentStep - 1];
      const systemAddition = currentStepData && !isInit
        ? `\n\nStep attuale (${currentStep}/${totalSteps}): ${currentStepData.text || currentStepData.step_text}`
        : "";

      const homeworkContent = getHomeworkContent(homework);

      const studentName = profile?.name || "";
      const initDirective = isInit
        ? `\n\n[INIZIALIZZAZIONE SESSIONE — REGOLE ASSOLUTE]
Lo studente NON ha ancora scritto NULLA in questa chat. Non ti ha detto come sta, non ti ha detto cosa pensa, non ti ha chiesto nulla.

VIETATO in questo primo messaggio:
• "Grazie per avermelo detto" / "grazie per avermi detto" / qualunque ringraziamento per qualcosa che lo studente non ha detto
• "Come stai oggi?" / "come ti senti?" / qualunque riferimento al suo stato emotivo
• "Ci adattiamo al tuo ritmo" / "capisco come ti senti" / qualunque reazione a un input inesistente
• "Come posso aiutarti?" come prima frase
• Usare SOLO il titolo del compito senza la descrizione completa
• Inventare misure, numeri, figure, domande non presenti nel contenuto qui sotto
• Mostrare bottoni bisogno o elenchi di opzioni di aiuto

OBBLIGATORIO — produci ESATTAMENTE questo formato (una sola riga, senza preamboli):
"Ciao${studentName ? " " + studentName : ""}! Ho visto il tuo compito. Devi [descrizione esatta di cosa chiede il problema, includendo TUTTE le misure, le figure e TUTTE le domande a/b/c/... presenti nel contenuto del compito qui sotto]. Iniziamo?"

Niente altro. Nessuna seconda frase. Nessuna domanda aggiuntiva. Aspetta la conferma dello studente.`
        : "";

      const systemPrompt = `Sei in una sessione di studio guidata con ${profile?.name || "lo studente"} (livello: ${schoolLevel}).
Materia: ${homework?.subject || "—"}.

═══════════════════════════════════════
RULE 0 — CONTENT FIRST, BISOGNO SECOND. ALWAYS.
═══════════════════════════════════════
Hai ricevuto il contenuto esatto del compito dello studente qui sotto, nella sezione HOMEWORK CONTENT.

Il TUO PRIMO MESSAGGIO può essere SOLO ed esclusivamente in questo formato esatto:
"Ciao${studentName ? " " + studentName : ""}! Ho visto il tuo compito. Devi [descrizione esatta di cosa chiede il problema, incluse TUTTE le misure, figure e TUTTE le domande a/b/c/... visibili nel contenuto qui sotto]. Iniziamo?"

VIETATO nel primo messaggio:
• Ringraziare lo studente per qualcosa ("grazie per avermelo detto", "grazie per avermi detto") — non ti ha detto nulla.
• Riferirsi al suo stato emotivo ("come stai", "ci adattiamo al tuo ritmo", "capisco come ti senti").
• Chiedere "Come posso aiutarti?" come prima frase.
• Usare solo il titolo del compito senza la descrizione completa con misure e domande.
• Mostrare i bottoni bisogno o elencarli nel testo.

Aspetta che lo studente confermi.

SOLO DOPO che lo studente ha confermato → chiedi:
"Come posso aiutarti?"
e mostra i bottoni di scelta del bisogno (NON elencarli nel testo, il client li renderizza).

MAI mostrare i bottoni bisogno come primo messaggio.
MAI saltare la conferma del contenuto.
MAI inventare misure, numeri, figure o dati che non siano esplicitamente presenti nel contenuto qui sotto.
Se sei incerto su un valore specifico → chiedi allo studente di confermare quel valore. NON tirare a indovinare.

═══════════════════════════════════════
RULE 0b — CAMBIA IDEA SOLO SE PUOI VERIFICARE
═══════════════════════════════════════
Se lo studente è in disaccordo con la tua interpretazione del problema:
1. Rileggi il contenuto del compito qui sotto con attenzione.
2. Se rileggendo confermi che lo studente ha ragione → correggi te stesso chiaramente:
   "Hai ragione — rileggendo vedo che [riferimento esatto al testo]. Mi sono sbagliato, partiamo dal tuo approccio."
3. Se rileggendo confermi che eri tu ad aver ragione → mantieni la posizione con riferimento diretto al testo:
   "Capisco il tuo ragionamento — ma guardando il problema, [citazione specifica]. Proviamo così?"
4. Se ambiguo, non puoi verificare → chiedi:
   "Non riesco a verificarlo dal testo che ho — puoi indicarmi esattamente quale parte del problema ti fa pensare questo?"

MAI dire "hai ragione" senza averlo verificato nel contenuto qui sotto.
MAI mantenere un'interpretazione sbagliata per orgoglio.
MAI scusarti per un'interpretazione corretta.
L'obiettivo è sempre l'accuratezza, non evitare il conflitto.

═══════════════════════════════════════
PEDAGOGIA
═══════════════════════════════════════
Non dare mai la risposta diretta. Guida lo studente con domande socratiche.
Se lo studente risponde correttamente a uno step, scrivi [STEP_COMPLETATO: ${currentStep}].
Se tutti gli step sono completati, scrivi [SESSIONE_COMPLETATA].${systemAddition}

═══════════════════════════════════════
--- HOMEWORK CONTENT ---
Materia: ${homework?.subject || "—"}
Titolo: ${homework?.title || "—"}

${homeworkContent}
--- END HOMEWORK CONTENT ---
═══════════════════════════════════════${initDirective}`;

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: isInit
              ? [{ role: "user", content: "Inizia la sessione." }]
              : newMessages.map(m => ({ role: m.role, content: m.content })),
            systemPrompt,
            mode: "guided_session",
            stream: true,
          }),
        }
      );

      if (!res.ok) throw new Error("AI response failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  fullText += token;
                  setStreamingText(fullText);
                }
              } catch {}
            }
          }
        }
      }

      // Process signals
      let displayText = fullText;
      const stepComplete = fullText.match(/\[STEP_COMPLETATO:\s*(\d+)\]/);
      const sessionComplete = fullText.includes("[SESSIONE_COMPLETATA]");
      const difficultySignal = fullText.match(/\[SEGNALA_DIFFICOLTÀ:\s*(.+?)\]/);

      displayText = displayText.replace(/\[STEP_COMPLETATO:\s*\d+\]/, "").replace("[SESSIONE_COMPLETATA]", "").replace(/\[SEGNALA_DIFFICOLTÀ:\s*.+?\]/, "").trim();

      setStreamingText("");
      if (hideUser) {
        // Init turn: keep history clean — only the assistant confirmation is visible
        setMessages([{ role: "assistant", content: displayText }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: displayText }]);
      }

      if (stepComplete) {
        const stepNum = parseInt(stepComplete[1]);
        await supabase.from("study_steps").update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("session_id", sessionId).eq("step_number", stepNum);

        if (stepNum < totalSteps) {
          const next = stepNum + 1;
          setCurrentStep(next);
          await supabase.from("guided_sessions").update({ current_step: next, updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        }
      }

      if (difficultySignal) {
        await supabase.from("learning_errors").insert({
          user_id: userId,
          subject: homework?.subject,
          topic: difficultySignal[1],
          error_type: "incomprensione",
          session_id: sessionId,
        });
      }

      if (sessionComplete) {
        await supabase.from("guided_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
        await supabase.from("homework_tasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("id", homeworkId);
        
        // Generate flashcards in background
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              subject: homework?.subject,
              conversationHistory: newMessages,
              schoolLevel,
              lang: getCurrentLang(),
            }),
          }).then(async (r) => {
            if (r.ok) {
              const result = await r.json();
              if (result.cards?.length) {
                const rows = result.cards.map((c: any) => ({
                  user_id: userId,
                  subject: homework?.subject,
                  question: c.question,
                  answer: c.answer,
                  difficulty: c.difficulty || 1,
                  source_session_id: sessionId,
                }));
                await supabase.from("flashcards").insert(rows);
              }
            }
          }).catch(() => {});
        } catch {}

        setTimeout(() => {
          playCelebrationSound();
          setShowCelebration(true);
        }, 500);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages([...newMessages, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }

  function handleHint() {
    sendMessage("Dammi un indizio per questo step.");
  }

  function handleStuck() {
    sendMessage("Sono bloccato — cambia approccio e aiutami in modo più semplice.");
  }

  function handleBack() {
    if (messages.length > 1 && sessionId) {
      setShowPauseDialog(true);
    } else {
      navigate("/dashboard");
    }
  }

  async function pauseSession() {
    if (sessionId) {
      await supabase.from("guided_sessions").update({
        status: "paused",
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    navigate("/dashboard");
  }

  async function abandonSession() {
    if (sessionId) {
      await supabase.from("guided_sessions").update({
        status: "abandoned",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    navigate("/dashboard");
  }

  const progressPercent = totalSteps > 0 ? ((currentStep - 1) / totalSteps) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (needsContent) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold">{homework?.title || "Compito"}</span>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 mb-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Non riesco a trovare il contenuto del compito
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Puoi scrivere qui il testo del problema, incluse tutte le misure e le domande?
              </p>
            </div>
          </div>

          <textarea
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder="Scrivi qui il testo completo del problema, incluse tutte le misure, le figure e le domande a) b) c)..."
            rows={10}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-[15px] leading-relaxed"
          />

          <div className="flex items-center justify-between mt-2 mb-4 px-1">
            <span className="text-xs text-muted-foreground">
              {manualContent.trim().length < 80
                ? `Almeno 80 caratteri (${manualContent.trim().length}/80)`
                : "Pronto per iniziare"}
            </span>
          </div>

          <Button
            onClick={() => {
              setOverrideContent(manualContent.trim());
              setNeedsContent(false);
              setLoading(true);
              setTimeout(() => startNewSession("neutro"), 50);
            }}
            disabled={manualContent.trim().length < 80}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl py-5 text-base disabled:opacity-40"
          >
            Inizia con questo testo →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {homework?.title || "Sessione di studio"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              Step {currentStep} di {totalSteps}
            </span>
            <div className="flex-1 h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden max-w-32">
              <motion.div
                className="h-full bg-[var(--color-accent)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
        {homework?.subject && (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium">
            {homework.subject}
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-[15px] leading-[1.7] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[var(--color-accent)] text-white rounded-br-sm"
                    : "bg-slate-100 text-[var(--color-text-primary)] rounded-bl-sm"
                }`}
              >
                <MathText>{msg.content}</MathText>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-slate-100 px-4 py-3 text-[15px] leading-[1.7] whitespace-pre-wrap text-[var(--color-text-primary)]">
              <MathText>{streamingText}</MathText>
              <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <div className="bg-slate-100 rounded-xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
            </div>
          </div>
        )}
      </div>

      {/* Input toolbar */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button onClick={() => {
            try {
              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (!SpeechRecognition) return;
              const recognition = new SpeechRecognition();
              recognition.lang = "it-IT";
              recognition.continuous = false;
              recognition.interimResults = false;
              recognition.onresult = (e: any) => {
                const transcript = e.results[0][0].transcript;
                if (transcript) sendMessage(transcript);
              };
              recognition.start();
            } catch {}
          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending}>
            <Mic className="w-3.5 h-3.5" />
            Voce
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            Allega
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              sendMessage(`[Ho allegato un file: ${file.name}] Analizzalo nel contesto di questo compito.`);
            }} />
          </label>
          <button onClick={handleHint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-medium hover:bg-[var(--color-accent-light)] transition-colors" disabled={sending}>
            <Lightbulb className="w-3.5 h-3.5" />
            Indizio
          </button>
          <button onClick={handleStuck} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending}>
            <AlertCircle className="w-3.5 h-3.5" />
            Bloccato
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending} onClick={() => setShowExplainOptions(!showExplainOptions)}>
              <RefreshCw className="w-3.5 h-3.5" />
              Spiega diversamente
            </button>
            {showExplainOptions && (
              <div className="absolute bottom-full left-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                {[
                  { label: "Più semplice", msg: "Spiegamelo in modo più semplice." },
                  { label: "Con un esempio", msg: "Fammi un esempio pratico per capire meglio." },
                  { label: "Passo passo", msg: "Spiegamelo passo passo, più lentamente." },
                  { label: "Più breve", msg: "Spiegamelo in modo più breve e diretto." },
                ].map(opt => (
                  <button key={opt.label} onClick={() => { setShowExplainOptions(false); sendMessage(opt.msg); }}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi la tua risposta..."
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="bg-[var(--color-accent)] hover:bg-[#005fa3] rounded-xl h-10 w-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Pause dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vuoi mettere in pausa?</AlertDialogTitle>
            <AlertDialogDescription>
              Riprenderemo da dove ti sei fermato la prossima volta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowPauseDialog(false)}>Continua</AlertDialogCancel>
            <AlertDialogAction onClick={pauseSession} className="bg-[var(--color-accent)]">Metti in pausa</AlertDialogAction>
            <AlertDialogAction onClick={abandonSession} className="bg-[var(--color-danger)]">Abbandona</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Celebration */}
      <SessionCelebration
        isVisible={showCelebration}
        onClose={() => { setShowCelebration(false); navigate("/dashboard"); }}
        onGoToReview={() => { setShowCelebration(false); navigate("/memory?section=ripasso&content=today"); }}
        studentName={profile?.name || "Studente"}
        bloomLevel={currentStep}
        subject={homework?.subject || ""}
      />
    </div>
  );
}
