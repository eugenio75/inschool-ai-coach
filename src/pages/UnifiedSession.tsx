import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDailyMissions, completeMission } from "@/lib/database";
import {
  BookOpen, Plus,
  FileText,
  Map,
  List,
  Key,
  Layers,
  Loader2,
  Brain,
  MessageCircle,
  CalendarDays,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { ChatShell } from "@/components/ChatShell";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { SessionCelebration } from "@/components/SessionCelebration";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/contexts/LangContext";
import { getPrepLabelKey } from "@/lib/schoolTerms";
import { useGuidedSession } from "@/hooks/useGuidedSession";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageBackButton } from "@/components/shared/PageBackButton";

import { getSubjectsByLevel } from "@/lib/subjectsByLevel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// getPrepLabel now handled via i18n — see getTitle()

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
  const { t } = useLang();
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

  const guided = useGuidedSession({
    homeworkId,
    userId,
    schoolLevel,
    profileName: studentName,
  });

  useEffect(() => {
    if (type === "guided" && homeworkId) {
      guided.loadSession();
    }
  }, [type, homeworkId]);

  const [setupDone, setSetupDone] = useState(false);
  const [topic, setTopic] = useState(urlSubject ? `Ripasso ${urlSubject}` : "");
  const [subject, setSubject] = useState(urlSubject || "");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");
  const [customSubject, setCustomSubject] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [learningGaps, setLearningGaps] = useState<string[]>([]);
  const missionsCompletedRef = useRef(false);
  const [reviewMode, setReviewMode] = useState<"chat" | "flashcard">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [guidedCustomEmotion, setGuidedCustomEmotion] = useState("");
  const [coachName, setCoachName] = useState<string | undefined>(undefined);

  // Load coach name from preferences
  useEffect(() => {
    const loadCoachName = async () => {
      const pid = getChildSession()?.profileId || profile?.id;
      if (!pid) return;
      const { data } = await supabase.from("user_preferences").select("data").eq("profile_id", pid).maybeSingle();
      const prefs = (data?.data as any) || {};
      if (prefs.coach_name) setCoachName(prefs.coach_name);
    };
    loadCoachName();
  }, []);

  // Fetch learning gaps for prep mode
  useEffect(() => {
    if (type !== "prep" || !userId) return;
    const fetchGaps = async () => {
      const query = supabase
        .from("learning_errors")
        .select("subject, topic, description, error_type")
        .eq("user_id", userId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (subject) query.eq("subject", subject);
      const { data } = await query;
      if (data && data.length > 0) {
        setLearningGaps(data.map(e => `[${e.subject}] ${e.topic || ""}: ${e.description || e.error_type || ""}`).filter(Boolean));
      } else {
        setLearningGaps([]);
      }
    };
    fetchGaps();
  }, [type, subject, userId]);

  useEffect(() => {
    if (urlSubject && type === "review" && !setupDone && !sending) {
      const t = setTimeout(() => startSession(), 100);
      return () => clearTimeout(t);
    }
  }, [urlSubject, type]);

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
          extraBody: { profileId, subject: subject || undefined, sessionFormat: type },
        });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [urlMsg]);

  // Use profile subjects first, then fall back to school-level subjects
  const favSubjects = profile?.favorite_subjects || profile?.favoriteSubjects || [];
  const diffSubjects = profile?.difficult_subjects || profile?.difficultSubjects || [];
  const profileSubjects = [
    ...favSubjects,
    ...diffSubjects.filter((s: string) => !favSubjects.includes(s)),
  ];
  const subjects = profileSubjects.length > 0 ? profileSubjects : getSubjectsByLevel(schoolLevel);

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
      case "prep": {
        const gapsBlock = learningGaps.length > 0
          ? `\nLACUNE RILEVATE dallo storico dello studente:\n${learningGaps.map(g => `- ${g}`).join("\n")}\nUsa queste lacune per calibrare le domande: insisti sui punti deboli per verificarne il recupero.`
          : "";
        const topicBlock = topic.trim()
          ? `ARGOMENTO SPECIFICO: ${topic.trim()}\nLe domande DEVONO essere focalizzate su questo argomento, tenendo conto delle lacune da colmare.`
          : `Nessun argomento specifico indicato. Fai domande sugli argomenti della materia dove lo studente ha più lacune.${!gapsBlock ? " Copri i concetti fondamentali della materia." : ""}`;
        return `Sei il Coach AI di ${studentName}. Stai conducendo una SIMULAZIONE DI ${mode === "orale" ? "INTERROGAZIONE ORALE" : "VERIFICA SCRITTA"}.
MATERIA: ${subject}
${topicBlock}
LIVELLO: ${schoolLevel}
${gapsBlock}

REGOLE:
- Fai domande calibrate e specifiche — NON domande generiche
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
      }
      default:
        return "";
    }
  }

  function getTitle(): string {
    if (type === "guided") return guided.homework?.title || "Sessione guidata";
    switch (type) {
      case "study":
        return "Studio libero";
      case "review":
        return t("session_review");
      case "prep":
        return t(getPrepLabelKey(schoolLevel));
      default:
        return t("session_default");
    }
  }

  function startSession() {
    if (!topic.trim() && type !== "prep" && type !== "review") return;
    if (!topic.trim() && type === "review" && subject) {
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
      extraBody: { profileId, subject: subject || undefined, sessionFormat: type },
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
        setMessages(prev => {
          const updated = [...prev, { role: "assistant" as const, content: full }];
          // Complete missions after meaningful engagement (4+ messages)
          if (!missionsCompletedRef.current && updated.length >= 4) {
            missionsCompletedRef.current = true;
            getDailyMissions().then(missions => {
              for (const mission of missions) {
                if (mission.completed) continue;
                const t = mission.mission_type;
                if (t === "study_session" || (t === "review_concept" && type === "review") || (t === "review_weak_concept" && type === "review")) {
                  completeMission(mission.id, mission.points_reward).catch(() => {});
                }
              }
            }).catch(() => {});
          }
          return updated;
        });
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined, sessionFormat: type },
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

  if (type === "guided") {
    if (guided.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }

    if (guided.showFamiliarity) {
      const familiarityOptions = [
        { key: "first_time" as const, label: "È la prima volta", desc: "Non l'ho mai visto", icon: "🆕" },
        { key: "partial" as const, label: "Lo conosco in parte", desc: "L'ho studiato ma non sono sicuro", icon: "🔄" },
        { key: "already_know" as const, label: "Lo conosco già", desc: "L'ho studiato e lo ricordo", icon: "✅" },
      ];

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              Prima di iniziare, dimmi:
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              Hai già studiato questo argomento?
            </p>
            <p className="text-xs text-primary font-medium mb-6">
              {guided.homework?.title}
            </p>
            <div className="space-y-3">
              {familiarityOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => guided.selectFamiliarity(opt.key)}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <span className="font-medium text-foreground block">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      );
    }

    if (guided.showCheckin) {
      // Age-differentiated emotional check-in
      const isElementari = schoolLevel === "alunno" || schoolLevel === "elementari";
      const isMediaLevel = schoolLevel === "medie" || schoolLevel?.startsWith("media-");
      const isUni = schoolLevel === "universitario";

      let checkinQuestion = "Come ti senti per iniziare?";
      let guidedEmotionOptions: { key: string; label: string; icon: string }[];

      if (isElementari) {
        checkinQuestion = "Come ti senti adesso?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Pronto", icon: "😊" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "bloccato", label: "Un po' bloccato", icon: "😕" },
        ];
      } else if (isMediaLevel) {
        checkinQuestion = "Come ti senti per iniziare?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Concentrato", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "bloccato", label: "Un po' bloccato", icon: "😕" },
        ];
      } else if (isUni) {
        checkinQuestion = "Come ti senti?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Pronto", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "confuso", label: "Distratto", icon: "😵" },
        ];
      } else {
        // superiori
        checkinQuestion = "Come stai adesso?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Concentrato", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "agitato", label: "Sotto pressione", icon: "😬" },
        ];
      }

      const submitCustomEmotion = () => {
        const value = guidedCustomEmotion.trim();
        if (!value) return;
        guided.startNewSession(value);
      };

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              {checkinQuestion}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {guided.homework?.title}
            </p>
            <div className={`grid gap-3 mb-4 ${isElementari ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {guidedEmotionOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => guided.startNewSession(opt.key)}
                  className={`flex items-center gap-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left ${
                    isElementari ? "p-5" : "p-4"
                  }`}
                >
                  <span className={isElementari ? "text-4xl" : "text-2xl"}>{opt.icon}</span>
                  <span className={`font-medium text-foreground ${isElementari ? "text-lg" : ""}`}>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={guidedCustomEmotion}
                onChange={(e) => setGuidedCustomEmotion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCustomEmotion();
                }}
                placeholder="Se non trovi l'opzione giusta, scrivila qui"
                className="flex-1"
              />
              <Button onClick={submitCustomEmotion} disabled={!guidedCustomEmotion.trim()}>
                Continua
              </Button>
            </div>
          </motion.div>
        </div>
      );
    }

    const handleGuidedBack = () => {
      if (guided.messages.length > 1 && guided.sessionId) {
        setShowPauseDialog(true);
      } else {
        navigate("/dashboard");
      }
    };

    const isReadOnly = guided.sessionCompleted;

    return (
      <>
        <ChatShell
          coachName={coachName}
          title={guided.homework?.title || "Sessione guidata"}
          subtitle={isReadOnly ? `${guided.homework?.subject} · ✅ Completato` : guided.homework?.subject}
          progress={!isReadOnly && (guided.methodPhase === "none" || guided.methodPhase === "ready") ? guided.progressPercent : undefined}
          progressLabel={!isReadOnly && (guided.methodPhase === "none" || guided.methodPhase === "ready") ? guided.progressLabel : undefined}
          messages={guided.messages}
          streamingText={guided.streamingText}
          sending={guided.sending}
          onSend={isReadOnly ? undefined : guided.handleSend}
          onAction={guided.handleMethodAction}
          onBack={handleGuidedBack}
          showHint={!isReadOnly}
          showStuck={!isReadOnly}
          showExplain={!isReadOnly}
          showVoice={!isReadOnly}
          showAttach={!isReadOnly}
          showPomodoro={!isReadOnly}
          pomodoroMinutes={profile?.focus_time || 25}
          inputPlaceholder={isReadOnly ? "Sessione completata — chat in sola lettura" : "Scrivi la tua risposta..."}
          disabled={isReadOnly}
        />

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

        <SessionCelebration
          isVisible={guided.showCelebration}
          onClose={() => {
            guided.setShowCelebration(false);
            navigate("/dashboard");
          }}
          onGoToReview={() => {
            guided.setShowCelebration(false);
            navigate("/memory?section=ripasso&content=today");
          }}
          studentName={studentName}
          bloomLevel={guided.currentStep}
          subject={guided.homework?.subject || ""}
          isJunior={isJunior}
          pointsEarned={guided.celebrationPoints}
          totalPoints={guided.celebrationTotalPoints}
          previousTotalPoints={guided.celebrationPreviousTotal}
          streak={guided.celebrationStreak}
        />
      </>
    );
  }

  if (!setupDone) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton to="/dashboard" />
          <h1 className="font-display text-lg font-bold text-foreground">{getTitle()}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {type === "review" ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground mb-2 block">Scegli cosa ripassare</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "today", label: t("review_today"), icon: CalendarDays },
                  { id: "cumulative", label: t("review_cumulative"), icon: Brain },
                  { id: "prep", label: t(getPrepLabelKey(schoolLevel)), icon: GraduationCap },
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

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input
                  value={topic.startsWith("Ripassa") || topic.startsWith("Ripasso") || topic.startsWith("Review") || topic.startsWith("Prepare") || topic === t(getPrepLabelKey(schoolLevel)) ? "" : topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder={t("review_topic_placeholder")}
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
              {!showCustomInput && (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="px-3 py-1.5 text-xs rounded-full border border-dashed border-border text-muted-foreground hover:border-foreground/40 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Aggiungi materia
                </button>
              )}
            </div>
            {showCustomInput && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Es: Elettronica, Diritto..."
                  className="text-sm flex-1"
                  onKeyDown={e => {
                    if (e.key === "Enter" && customSubject.trim()) {
                      setSubject(customSubject.trim());
                      setShowCustomInput(false);
                      setCustomSubject("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (customSubject.trim()) {
                      setSubject(customSubject.trim());
                      setShowCustomInput(false);
                      setCustomSubject("");
                    }
                  }}
                  disabled={!customSubject.trim()}
                >
                  Aggiungi
                </Button>
              </div>
            )
          </div>

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
                {([ ["scritta", "Verifica scritta"], ["orale", "Interrogazione orale"] ] as const).map(([m, label]) => (
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
              <label className="text-sm font-medium text-foreground mb-1 block">Argomento specifico (opzionale)</label>
              <p className="text-xs text-muted-foreground mb-2">
                {topic.trim()
                  ? "Le domande saranno focalizzate su questo argomento, tenendo conto delle tue lacune"
                  : "Senza argomento, la simulazione si concentra sugli argomenti dove hai più lacune"}
              </p>
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
      coachName={coachName}
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
