import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, FileText, Map, List, Key, Layers, Loader2, Brain, MessageCircle, CalendarDays, Sparkles, GraduationCap } from "lucide-react";
import { ChatShell } from "@/components/ChatShell";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { SessionCelebration } from "@/components/SessionCelebration";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { useGuidedSession } from "@/hooks/useGuidedSession";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getPrepLabel(schoolLevel: string) {
  switch (schoolLevel) {
    case "alunno": case "medie": return "Prepara l'interrogazione";
    case "universitario": return "Prepara l'esame";
    default: return "Prepara la verifica";
  }
}

const OUTPUT_TYPES = [
  { id: "schema", label: "Schema", icon: List },
  { id: "mappa", label: "Mappa concettuale", icon: Map },
  { id: "sintesi_breve", label: "Sintesi breve", icon: FileText },
  { id: "sintesi_estesa", label: "Sintesi estesa", icon: BookOpen },
  { id: "glossario", label: "Glossario", icon: Key },
  { id: "punti_chiave", label: "Punti chiave", icon: Layers },
];

type SessionType = "study" | "review" | "prep" | "guided";

export default function UnifiedSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") || "study") as SessionType;
  const homeworkId = searchParams.get("hw");
  const urlSubject = searchParams.get("subject");
  const urlMsg = searchParams.get("msg");
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const { user } = useAuth();
  const studentName = profile?.name || "Studente";
  const profileId = profile?.id || getChildSession()?.profileId;
  const userId = user?.id || profileId;
  const isJunior = schoolLevel === "alunno" || schoolLevel === "medie";

  // ─── Guided session hook ───
  const guided = useGuidedSession({
    homeworkId,
    userId,
    schoolLevel,
    profileName: studentName,
  });

  // Load guided session on mount
  useEffect(() => {
    if (type === "guided" && homeworkId) {
      guided.loadSession();
    }
  }, [type, homeworkId]);

  // ─── Free-form session state (study/review/prep) ───
  const [setupDone, setSetupDone] = useState(false);
  const [topic, setTopic] = useState(urlSubject ? `Ripasso ${urlSubject}` : "");
  const [subject, setSubject] = useState(urlSubject || "");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");
  const [reviewMode, setReviewMode] = useState<"chat" | "flashcard">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  // Auto-start when subject is provided via URL for review
  useEffect(() => {
    if (urlSubject && type === "review" && !setupDone && !sending) {
      const t = setTimeout(() => startSession(), 100);
      return () => clearTimeout(t);
    }
  }, [urlSubject, type]);

  // Auto-start when msg is provided via URL (e.g. from coach mood chips)
  useEffect(() => {
    if (urlMsg && !setupDone && !sending) {
      setTopic(urlMsg);
      const t = setTimeout(() => {
        const systemPrompt = getSystemPrompt();
        setSetupDone(true);
        setMessages([]);
        setSending(true);
        setStreamingText("");

        streamChat({
          messages: [
            { role: "user", content: systemPrompt },
            { role: "user", content: urlMsg },
          ],
          onDelta: (full) => setStreamingText(full),
          onDone: (full) => {
            setMessages([
              { role: "user", content: urlMsg },
              { role: "assistant", content: full },
            ]);
            setStreamingText("");
            setSending(false);
          },
          extraBody: { profileId, subject: subject || undefined },
        });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [urlMsg]);

  const subjects = profile?.favorite_subjects || profile?.difficult_subjects || ["Matematica", "Italiano", "Inglese", "Storia", "Scienze"];

  // ─── System prompts for non-guided types ───
  function getSystemPrompt(): string {
    switch (type) {
      case "study":
        return `Sei un coach di studio per ${studentName} (livello ${schoolLevel}).
L'argomento è: "${topic}" (${subject || "materia non specificata"}).
Dividi l'argomento in blocchi logici. Per ogni blocco:
1. Presenta brevemente il concetto
2. Fai una domanda di comprensione
3. Attendi la risposta prima di proseguire
4. Costruisci connessioni tra i blocchi
Non dare mai la risposta finale direttamente. Guida lo studente a ragionare.
Inizia presentando il primo blocco dell'argomento.`;
      case "review":
        return `Sei il Coach AI di ${studentName}. Stai facendo un RIPASSO PROFONDO.
MATERIA: ${subject || "generale"}
ARGOMENTO: ${topic}
LIVELLO: ${schoolLevel}

REGOLE:
- Fai domande aperte e profonde — mai rilettura passiva
- Richiamo attivo: lo studente deve ricordare, non rileggere
- Una domanda alla volta
- Dopo la risposta: conferma cosa è giusto, correggi cosa no
- Dopo 3-4 scambi: riassumi i punti forti e deboli emersi
- Sii socratico e incoraggiante
Inizia con la prima domanda sull'argomento.`;
      case "prep":
        return `Sei il Coach AI di ${studentName}. Stai conducendo una SIMULAZIONE DI ${mode === "orale" ? "INTERROGAZIONE ORALE" : "VERIFICA SCRITTA"}.
MATERIA: ${subject}
LIVELLO: ${schoolLevel}

REGOLE:
- Fai domande calibrate sulla materia — NON domande generiche
- ${mode === "orale" ? "Simula un'interrogazione: una domanda alla volta, attendi risposta, fai follow-up" : "Fai domande di diverso tipo: definizioni, problemi, ragionamento"}
- Adatta la difficoltà: se risponde bene alza, se sbaglia abbassa
- Dopo 5-6 domande, fornisci un REPORT finale strutturato con:
  [REPORT]
  Punti forti: ...
  Punti deboli: ...
  Priorità di ripasso: ...
  [/REPORT]
- Non dare mai la risposta — guida con indizi se bloccato
Inizia con la prima domanda.`;
      default:
        return "";
    }
  }

  function getTitle(): string {
    if (type === "guided") return guided.homework?.title || "Sessione guidata";
    switch (type) {
      case "study": return "Studio libero";
      case "review": return "Ripasso profondo";
      case "prep": return getPrepLabel(schoolLevel);
      default: return "Sessione";
    }
  }

  // ─── Non-guided session start ───
  function startSession() {
    if (!topic.trim() && type !== "prep" && type !== "review") return;
    if (!topic.trim() && type === "review" && subject) {
      // Auto-fill topic for review with subject
      setTopic(`Ripasso ${subject}`);
    }
    if (!subject && type === "prep") return;

    const systemPrompt = getSystemPrompt();
    setSetupDone(true);
    setMessages([]);
    setSending(true);
    setStreamingText("");

    streamChat({
      messages: [{ role: "user", content: systemPrompt }],
      onDelta: (full) => setStreamingText(full),
      onDone: (full) => {
        setMessages([{ role: "assistant", content: full }]);
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined },
    }).catch(() => {
      setMessages([{ role: "assistant", content: "Mi dispiace, c'è stato un problema. Riprova." }]);
      setStreamingText("");
      setSending(false);
    });
  }

  const handleSend = useCallback((text: string) => {
    if (sending) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);
    setStreamingText("");

    streamChat({
      messages: newMessages,
      onDelta: (full) => setStreamingText(full),
      onDone: (full) => {
        setMessages(prev => [...prev, { role: "assistant", content: full }]);
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined },
    }).catch(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore. Riprova." }]);
      setStreamingText("");
      setSending(false);
    });
  }, [messages, sending, profileId, subject]);

  async function generateOutput(outputType: string) {
    const outputPrompts: Record<string, string> = {
      schema: `Genera uno schema strutturato dell'argomento "${topic}" basandoti sulla conversazione. Usa punti e sottopunti.`,
      mappa: `Genera una mappa concettuale testuale dell'argomento "${topic}". Mostra le connessioni tra i concetti principali.`,
      sintesi_breve: `Genera una sintesi breve (max 200 parole) dell'argomento "${topic}" basandoti sulla conversazione.`,
      sintesi_estesa: `Genera una sintesi estesa e dettagliata dell'argomento "${topic}" basandoti sulla conversazione.`,
      glossario: `Genera un glossario con i termini chiave dell'argomento "${topic}" emersi dalla conversazione, con definizioni concise.`,
      punti_chiave: `Elenca i 5-10 punti chiave dell'argomento "${topic}" emersi dalla conversazione. Ogni punto in una frase.`,
    };
    handleSend(outputPrompts[outputType] || outputPrompts.schema);
  }

  // ════════════════════════════════════════════
  // GUIDED MODE
  // ════════════════════════════════════════════
  if (type === "guided") {
    // Loading
    if (guided.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }

    // Emotional checkin
    if (guided.showCheckin) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              Come ti senti per iniziare?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {guided.homework?.title}
            </p>
            <div className="flex flex-col gap-3">
              {[
                { key: "concentrato", label: "Concentrato", icon: "🎯" },
                { key: "stanco", label: "Un po' stanco", icon: "😴" },
                { key: "bloccato", label: "Bloccato in partenza", icon: "😕" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => guided.startNewSession(opt.key)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      );
    }

    // Chat view for guided
    const handleGuidedBack = () => {
      if (guided.messages.length > 1 && guided.sessionId) {
        setShowPauseDialog(true);
      } else {
        navigate("/dashboard");
      }
    };

    return (
      <>
        <ChatShell
          title={guided.homework?.title || "Sessione guidata"}
          subtitle={guided.homework?.subject}
          progress={guided.progressPercent}
          progressLabel={guided.progressLabel}
          messages={guided.messages}
          streamingText={guided.streamingText}
          sending={guided.sending}
          onSend={guided.handleSend}
          onBack={handleGuidedBack}
          showHint={true}
          showStuck={true}
          showExplain={true}
          showVoice={true}
          showAttach={true}
          inputPlaceholder="Scrivi la tua risposta..."
        />

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
              <AlertDialogAction onClick={guided.pauseSession} className="bg-primary">Metti in pausa</AlertDialogAction>
              <AlertDialogAction onClick={guided.abandonSession} className="bg-destructive">Abbandona</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Celebration */}
        <SessionCelebration
          isVisible={guided.showCelebration}
          onClose={() => { guided.setShowCelebration(false); navigate("/dashboard"); }}
          studentName={studentName}
          bloomLevel={guided.currentStep}
          subject={guided.homework?.subject || ""}
          isJunior={isJunior}
        />
      </>
    );
  }

  // ════════════════════════════════════════════
  // NON-GUIDED SETUP SCREEN
  // ════════════════════════════════════════════
  if (!setupDone) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}><BookOpen className="w-5 h-5 text-muted-foreground" /></button>
          <h1 className="font-display text-lg font-bold text-foreground">{getTitle()}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {type === "review" ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground mb-2 block">Scegli cosa ripassare</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "today", label: "Ripassa quello di oggi", icon: CalendarDays },
                  { id: "cumulative", label: "Ripasso cumulativo", icon: Brain },
                  { id: "prep", label: getPrepLabel(schoolLevel), icon: GraduationCap },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTopic(opt.label)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      topic === opt.label
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      topic === opt.label ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <opt.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Campo libero per argomento specifico */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input
                  value={topic.startsWith("Ripassa") || topic.startsWith("Ripasso") || topic === getPrepLabel(schoolLevel) ? "" : topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Oppure scrivi un argomento specifico..."
                  className="text-sm pl-9"
                />
              </div>
            </div>
          ) : type !== "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Cosa vuoi studiare?</label>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="es. La Rivoluzione Francese, Le equazioni di secondo grado..."
                className="text-sm"
                onKeyDown={e => e.key === "Enter" && startSession()}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {type === "prep" ? "Materia" : "Materia (opzionale)"}
            </label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s: string) => (
                <button
                  key={s}
                  onClick={() => setSubject(subject === s ? "" : s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    subject === s
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Review: mode selector */}
          {type === "review" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Modalità di ripasso</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewMode("chat")}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-medium transition-colors ${
                    reviewMode === "chat"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  Ripasso profondo
                </button>
                <button
                  onClick={() => setReviewMode("flashcard")}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-medium transition-colors ${
                    reviewMode === "flashcard"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <Brain className="w-5 h-5" />
                  Flashcard
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {reviewMode === "chat"
                  ? "Il coach fa domande aperte — ideale per concetti complessi"
                  : "Carte rapide con autovalutazione — ideale per memorizzare"}
              </p>
            </div>
          )}

          {type === "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tipo di simulazione</label>
              <div className="flex gap-3">
                {([["scritta", "Verifica scritta"], ["orale", "Interrogazione orale"]] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Argomento specifico (opzionale)</label>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="es. Capitolo 5, Termodinamica..."
                className="text-sm"
              />
            </div>
          )}

          <Button
            onClick={() => {
              if (type === "review" && reviewMode === "flashcard") {
                navigate(`/flashcards${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`);
                return;
              }
              startSession();
            }}
            disabled={type === "prep" ? !subject : type === "review" && reviewMode === "flashcard" ? false : !topic.trim()}
            className="w-full"
          >
            {type === "prep" ? "Inizia la simulazione" : type === "review" ? (reviewMode === "flashcard" ? "Inizia le flashcard" : "Inizia il ripasso") : "Inizia a studiare"}
          </Button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // NON-GUIDED CHAT VIEW
  // ════════════════════════════════════════════
  const studyOutputFooter = type === "study" && messages.length >= 4 ? (
    <div className="px-4 py-2 border-t border-border bg-muted/50">
      <p className="text-xs text-muted-foreground mb-2">Genera un output dalla sessione:</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {OUTPUT_TYPES.map(ot => (
          <button
            key={ot.id}
            onClick={() => generateOutput(ot.id)}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-foreground/40 whitespace-nowrap transition-colors"
          >
            <ot.icon className="w-3 h-3" />
            {ot.label}
          </button>
        ))}
      </div>
    </div>
  ) : undefined;

  return (
    <ChatShell
      title={topic || subject || getTitle()}
      subtitle={subject && topic ? subject : undefined}
      badgeText={type === "prep" ? (mode === "orale" ? "Orale" : "Scritta") : undefined}
      messages={messages}
      streamingText={streamingText}
      sending={sending}
      onSend={handleSend}
      onBack={() => navigate(-1)}
      showHint={type !== "prep"}
      showStuck={type !== "prep"}
      showExplain={true}
      showVoice={type === "prep" ? mode === "orale" || schoolLevel === "superiori" || schoolLevel === "universitario" : true}
      showAttach={type === "study"}
      extraFooter={studyOutputFooter}
      inputPlaceholder={type === "prep" ? "Scrivi la tua risposta..." : "Scrivi..."}
    />
  );
}
