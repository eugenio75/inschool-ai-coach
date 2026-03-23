import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Mic, MicOff, Loader2, FileText, CheckCircle, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";

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

export default function PrepSession() {
  const navigate = useNavigate();
  const { subject: paramSubject } = useParams();
  const { user } = useAuth();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";

  const [step, setStep] = useState<"setup" | "simulation" | "report">("setup");
  const [subject, setSubject] = useState(paramSubject || "");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [report, setReport] = useState<{ strengths: string[]; weaknesses: string[]; priorities: string[] } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const subjects = profile?.favorite_subjects || profile?.difficult_subjects || ["Matematica", "Italiano", "Inglese", "Storia", "Scienze"];

  const prepLabel = schoolLevel === "alunno" || schoolLevel === "medie"
    ? "Prepara l'interrogazione"
    : schoolLevel === "universitario"
    ? "Prepara l'esame"
    : "Prepara la verifica";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  function startSimulation() {
    if (!subject) return;
    setStep("simulation");

    const systemMsg = mode === "orale"
      ? "Simuliamo un'interrogazione orale. Ti farò domande una alla volta."
      : "Simuliamo una verifica scritta. Rispondi a ogni domanda con attenzione.";

    setMessages([{
      role: "assistant",
      content: `${systemMsg}\n\nMateria: ${subject}\n\nPrima domanda in arrivo...`,
    }]);

    // Send first AI message
    sendToAI([{ role: "assistant", content: systemMsg }], "Inizia la simulazione. Fai la prima domanda.");
  }

  async function sendToAI(history: ChatMessage[], userText: string) {
    setSending(true);
    setStreamingText("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const allMsgs = [...history, { role: "user" as const, content: userText }];

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
            systemPrompt: `Stai simulando una ${mode === "orale" ? "interrogazione orale" : "verifica scritta"} su ${subject} per uno studente di livello ${schoolLevel}. Fai domande calibrate. Dopo ogni risposta valuta brevemente e passa alla domanda successiva. Dopo 5-7 domande, scrivi [SIMULAZIONE_COMPLETATA] e poi genera un report JSON: {"strengths":["..."],"weaknesses":["..."],"priorities":["..."]}`,
            stream: true,
          }),
        }
      );

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) { fullText += token; setStreamingText(fullText); }
              } catch {}
            }
          }
        }
      }

      // Check for completion
      let displayText = fullText;
      if (fullText.includes("[SIMULAZIONE_COMPLETATA]")) {
        displayText = fullText.split("[SIMULAZIONE_COMPLETATA]")[0].trim();
        // Extract report
        const jsonMatch = fullText.match(/\{[\s\S]*"strengths"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            setReport(JSON.parse(jsonMatch[0]));
          } catch {}
        }
        setTimeout(() => setStep("report"), 1500);
      }

      setStreamingText("");
      setMessages(prev => [...prev, { role: "assistant", content: displayText }]);
    } catch (err) {
      console.error("PrepSession AI error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    await sendToAI(messages, text);
  }

  // Voice input
  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setInput(text);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {}
  }

  // Setup screen
  if (step === "setup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8"
        >
          <button onClick={() => navigate("/dashboard")} className="mb-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-text-primary)] mb-6">
            {prepLabel}
          </h1>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 block">Materia</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s: string) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      subject === s
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 block">Modalità</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "scritta" as const, label: "Simulazione scritta", icon: FileText },
                  { key: "orale" as const, label: "Simulazione orale", icon: Mic },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                      mode === m.key
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={startSimulation}
              disabled={!subject}
              className="w-full bg-[var(--color-accent)] hover:bg-[#005fa3] mt-4"
            >
              Inizia simulazione
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Report screen
  if (step === "report" && report) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto pt-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--color-text-primary)] mb-6 text-center">
              Risultato simulazione
            </h1>

            <div className="space-y-4">
              <div className="bg-[var(--color-success-light)] border border-green-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                  <h3 className="font-semibold text-[var(--color-success)]">Punti forti</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-green-800">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--color-warning-light)] border border-amber-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
                  <h3 className="font-semibold text-[var(--color-warning)]">Da ripassare</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.weaknesses.map((s, i) => (
                    <li key={i} className="text-sm text-amber-800">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--color-accent-light)] border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-[var(--color-accent)]" />
                  <h3 className="font-semibold text-[var(--color-accent)]">Priorità</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.priorities.map((s, i) => (
                    <li key={i} className="text-sm text-blue-800">{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => navigate("/memory")} variant="outline" className="flex-1">
                Inizia ripasso
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="flex-1 bg-[var(--color-accent)]">
                Torna alla dashboard
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Simulation chat
  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-[var(--color-bg)]">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{prepLabel}</h1>
          <span className="text-xs text-[var(--color-text-muted)]">{subject} — {mode === "orale" ? "Orale" : "Scritta"}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <span className="text-white text-xs font-bold">C</span>
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-[var(--color-accent)] text-white rounded-br-sm" : "bg-slate-100 text-[var(--color-text-primary)] rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {streamingText}<span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse" />
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

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          {mode === "orale" && (
            <button type="button" onClick={toggleVoice}
              className={`p-2.5 rounded-xl border transition-colors ${isListening ? "bg-red-50 border-red-300 text-red-500" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Scrivi la tua risposta..."
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sending} className="bg-[var(--color-accent)] rounded-xl h-10 w-10">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
