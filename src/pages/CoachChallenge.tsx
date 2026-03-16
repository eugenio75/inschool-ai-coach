import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Mic, MicOff, Sparkles, Trophy, Timer, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDailyMissions, completeMission, getGamification } from "@/lib/database";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface ChatMessage {
  id: string;
  role: "coach" | "student";
  text: string;
}

const CoachChallenge = () => {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());
  const pausedAtRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [paused]);

  const togglePause = () => {
    if (paused) {
      // Resume: shift startTime forward by the paused duration
      const pausedDuration = Date.now() - (pausedAtRef.current || Date.now());
      startTimeRef.current += pausedDuration;
      pausedAtRef.current = null;
      setPaused(false);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
    }
  };

  const minutesElapsed = Math.floor(elapsed / 60);
  const secondsElapsed = elapsed % 60;

  // Load mission
  useEffect(() => {
    const load = async () => {
      const missions = await getDailyMissions();
      const found = missions.find((m: any) => m.id === missionId);
      if (found) {
        setMission(found);
        if (found.completed) setCompleted(true);
      }
      setLoading(false);
    };
    load();
  }, [missionId]);

  // Initial coach message based on mission
  useEffect(() => {
    if (!mission || messages.length > 0) return;

    const profile = getProfile();
    const name = profile?.name || "campione";
    const metadata = mission.metadata || {};
    const subject = metadata.subject || "";

    const initial = `Ciao ${name}! 🌟 Benvenuto alla Sfida del Coach!\n\n"${mission.title}"\n\n${mission.description}\n\nSei pronto a iniziare? Questa è una sfida speciale pensata solo per te! Rispondi e iniziamo! 💪`;

    setMessages([{ id: "init", role: "coach", text: initial }]);
  }, [mission]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  const getProfile = () => {
    try {
      if (isChildSession()) {
        const session = getChildSession();
        return session?.profile || null;
      }
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  // Speech recognition
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setInput("(Browser non supportato)"); return; }
    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const streamCoachReply = async (allMessages: ChatMessage[]) => {
    setIsTyping(true);
    setStreamingText("");

    const profile = getProfile();
    const metadata = mission?.metadata || {};

    const chatMessages = allMessages.map(m => ({
      role: m.role === "coach" ? "assistant" as const : "user" as const,
      content: m.text,
    }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: chatMessages,
            studentProfile: profile ? {
              name: profile.name,
              age: profile.age,
              schoolLevel: profile.school_level,
              struggles: profile.struggles,
              supportStyle: profile.support_style,
              focusTime: profile.focus_time,
            } : undefined,
            taskContext: {
              title: mission?.title || "Sfida del Coach",
              subject: metadata.subject || "Misto",
              description: `SFIDA DEL COACH: ${mission?.description || mission?.title}. Questa è una sessione speciale dove devi creare un'esperienza interattiva e coinvolgente per lo studente, mescolando le materie in modo creativo. Non è un compito tradizionale: è una sfida divertente che usa la narrativa per motivare il ripasso.`,
              sourceType: "coach_challenge",
              keyConcepts: metadata.concepts || [],
              difficulty: 2,
            },
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Errore di connessione");
      }
      if (!response.body) throw new Error("No stream body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setStreamingText(assistantText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantText) {
        setMessages(prev => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: assistantText }]);
      }
    } catch (err) {
      console.error("Coach challenge error:", err);
      setMessages(prev => [...prev, {
        id: `coach-${Date.now()}`,
        role: "coach",
        text: "Scusa, c'è stato un piccolo problema. Riproviamo! Raccontami cosa sai su questo argomento 😊",
      }]);
    } finally {
      setIsTyping(false);
      setStreamingText("");
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const newMsg: ChatMessage = { id: `student-${Date.now()}`, role: "student", text: trimmed };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput("");
    streamCoachReply(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = async () => {
    if (minutesElapsed < 5) return;
    if (mission && !completed) {
      await completeMission(mission.id, mission.points_reward);
      setCompleted(true);
      setShowCelebration(true);
    }
  };

  const handleExit = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Missione non trovata</p>
        <Button onClick={() => navigate("/dashboard")} variant="outline">Torna alla dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleExit} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h1 className="font-display text-sm font-bold text-foreground">Sfida del Coach</h1>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{mission.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePause}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                paused ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              title={paused ? "Riprendi" : "Pausa"}
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${paused ? "bg-clay-light" : "bg-muted"}`}>
              <Timer className={`w-3.5 h-3.5 ${paused ? "text-clay-dark" : "text-muted-foreground"}`} />
              <span className={`text-xs font-mono font-medium ${paused ? "text-clay-dark" : "text-foreground"}`}>
                {String(minutesElapsed).padStart(2, "0")}:{String(secondsElapsed).padStart(2, "0")}
                {paused && " ⏸"}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 rounded-xl px-3 py-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">+{mission.points_reward}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Minimum time indicator */}
      {minutesElapsed < 5 && !completed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-clay-light/50 border-b border-clay/20 px-4 py-2"
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-clay/20 rounded-full h-1.5">
                <motion.div
                  className="bg-clay h-1.5 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.min(100, (minutesElapsed / 5) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[10px] text-clay-dark font-medium whitespace-nowrap">
                {5 - minutesElapsed} min per completare
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "coach"
                    ? "bg-sage-light/50 text-foreground rounded-bl-md"
                    : "bg-primary text-primary-foreground rounded-br-md"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {streamingText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="max-w-[85%] bg-sage-light/50 text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-4 bg-primary/40 ml-0.5 animate-pulse" />
              </div>
            </motion.div>
          )}

          {isTyping && !streamingText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-sage-light/50 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Complete button */}
      {minutesElapsed >= 5 && !completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 bg-card border-t border-border"
        >
          <div className="max-w-3xl mx-auto">
            <Button onClick={handleComplete} className="w-full bg-primary text-primary-foreground rounded-2xl py-3 font-display font-bold">
              <Trophy className="w-4 h-4 mr-2" />
              Completa la sfida! +{mission.points_reward} punti
            </Button>
          </div>
        </motion.div>
      )}

      {/* Completed banner */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 bg-sage-light border-t border-primary/20"
        >
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-display font-bold text-sage-dark">🎉 Sfida completata! +{mission.points_reward} punti guadagnati!</p>
            <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mt-2 text-xs text-sage-dark">
              Torna alla dashboard
            </Button>
          </div>
        </motion.div>
      )}

      {/* Input area */}
      <div className="bg-card border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
              isRecording ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi la tua risposta..."
            className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachChallenge;
