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
...
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [guidedCustomEmotion, setGuidedCustomEmotion] = useState("");

  // Auto-start when subject is provided via URL for review
  useEffect(() => {
    if (urlSubject && type === "review" && !setupDone && !sending) {
      const t = setTimeout(() => startSession(), 100);
      return () => clearTimeout(t);
    }
  }, [urlSubject, type]);
...
    if (guided.showCheckin) {
      const guidedEmotionOptions = [
        { key: "concentrato", label: "Concentrato", icon: "🎯" },
        { key: "curioso", label: "Curioso", icon: "🤔" },
        { key: "carico", label: "Carico", icon: "⚡" },
        { key: "tranquillo", label: "Tranquillo", icon: "🙂" },
        { key: "stanco", label: "Un po' stanco", icon: "😴" },
        { key: "confuso", label: "Confuso", icon: "😵" },
        { key: "agitato", label: "Agitato", icon: "😬" },
        { key: "bloccato", label: "Bloccato in partenza", icon: "😕" },
      ];

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
              Come ti senti per iniziare?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {guided.homework?.title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {guidedEmotionOptions.map((opt) => (
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
