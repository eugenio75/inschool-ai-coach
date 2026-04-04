import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Send, Loader2, BookOpen, FileText, Map, List, Key, Layers, Plus,
} from "lucide-react";
import { PageBackButton } from "@/components/shared/PageBackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession, isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getSubjectsByLevel } from "@/lib/subjectsByLevel";


interface ChatMessage { role: "user" | "assistant"; content: string; }

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

const OUTPUT_TYPES = [
  { id: "schema", label: "Schema", icon: List },
  { id: "mappa", label: "Mappa concettuale", icon: Map },
  { id: "sintesi_breve", label: "Sintesi breve", icon: FileText },
  { id: "sintesi_estesa", label: "Sintesi estesa", icon: BookOpen },
  { id: "glossario", label: "Glossario", icon: Key },
  { id: "punti_chiave", label: "Punti chiave", icon: Layers },
];

export default function FreeStudySession() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || profile?.schoolLevel || "superiori";
  const [coachName, setCoachName] = useState("");

  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) return;
    supabase.from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.data as any) || {};
        if (prefs.coach_name) setCoachName(prefs.coach_name);
      });
  }, [profile?.id]);

  const [step, setStep] = useState<"setup" | "study" | "output">("setup");
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [generatingOutput, setGeneratingOutput] = useState(false);
  const [outputContent, setOutputContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  function startStudy() {
    if (!topic.trim()) return;
    setStep("study");

    const coachLabel = coachName || "il Coach";
    const systemPrompt = `Sei ${coachLabel}, il coach personale dello studente su InSchool. Livello: ${schoolLevel}. 
L'argomento è: "${topic}".
Quando ti presenti dì sempre "Sono ${coachLabel}, il tuo coach."
Dividi l'argomento in blocchi logici. Per ogni blocco:
1. Presenta brevemente il concetto
2. Fai una domanda di comprensione
3. Attendi la risposta prima di proseguire
4. Costruisci connessioni tra i blocchi

Non dare mai la risposta finale direttamente. Guida lo studente a ragionare.
Inizia presentando il primo blocco dell'argomento.`;

    const initialMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([initialMsg]);
    callAI([{ role: "user", content: systemPrompt }], true);
  }

  async function callAI(history: ChatMessage[], isFirst = false) {
    setSending(true);
    setStreamingText("");
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: history.map(m => ({ role: m.role, content: m.content })),
            schoolLevel,
            coachName: coachName || undefined,
          }),
        }
      );
      const text = await res.text();
      let content = text;
      try { const j = JSON.parse(text); content = j.response || j.message || text; } catch {}

      if (isFirst) {
        setMessages([{ role: "assistant", content }]);
      } else {
        setMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], content }]);
      }
    } catch {
      const fallback = "Mi dispiace, c'è stato un problema. Riprova.";
      if (isFirst) setMessages([{ role: "assistant", content: fallback }]);
      else setMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], content: fallback }]);
    }
    setSending(false);
  }

  function sendMessage() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg, { role: "assistant" as const, content: "" }];
    setMessages(newMessages);
    setInput("");
    callAI(newMessages.slice(0, -1));
  }

  async function generateOutput(type: string) {
    setGeneratingOutput(true);
    setOutputContent(null);
    setStep("output");

    const outputPrompts: Record<string, string> = {
      schema: `Genera uno schema strutturato dell'argomento "${topic}" basandoti sulla conversazione. Usa punti e sottopunti.`,
      mappa: `Genera una mappa concettuale testuale dell'argomento "${topic}". Mostra le connessioni tra i concetti principali.`,
      sintesi_breve: `Genera una sintesi breve (max 200 parole) dell'argomento "${topic}" basandoti sulla conversazione.`,
      sintesi_estesa: `Genera una sintesi estesa e dettagliata dell'argomento "${topic}" basandoti sulla conversazione.`,
      glossario: `Genera un glossario con i termini chiave dell'argomento "${topic}" emersi dalla conversazione, con definizioni concise.`,
      punti_chiave: `Elenca i 5-10 punti chiave dell'argomento "${topic}" emersi dalla conversazione. Ogni punto in una frase.`,
    };

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const allMsgs = [...messages, { role: "user" as const, content: outputPrompts[type] || outputPrompts.schema }];
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: allMsgs.map(m => ({ role: m.role, content: m.content })), schoolLevel, coachName: coachName || undefined }),
        }
      );
      const text = await res.text();
      let content = text;
      try { const j = JSON.parse(text); content = j.response || j.message || text; } catch {}
      setOutputContent(content);
    } catch {
      setOutputContent("Errore nella generazione. Riprova.");
    }
    setGeneratingOutput(false);
  }

  // SETUP
  if (step === "setup") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton to="/dashboard" />
          <h1 className="font-display text-lg font-bold text-foreground">Studio libero</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Cosa vuoi studiare?</label>
            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="es. La Rivoluzione Francese, Le equazioni di secondo grado..."
              className="text-sm"
              onKeyDown={e => e.key === "Enter" && startStudy()}
            />
          </div>
          <Button onClick={startStudy} disabled={!topic.trim()} className="w-full">
            Inizia a studiare
          </Button>
        </div>
      </div>
    );
  }

  // OUTPUT
  if (step === "output") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton to="/dashboard" />
          <h1 className="font-display text-lg font-bold text-foreground">Output — {topic}</h1>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-6">
          {generatingOutput ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Generazione in corso...</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {outputContent}
              </div>
              <div className="mt-6 pt-4 border-t border-border flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("study")}>Torna alla chat</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(outputContent || "");
                  import("sonner").then(m => m.toast.success("Copiato!"));
                }}>Copia</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STUDY (chat)
  return (
    <div className="min-h-screen bg-card flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <PageBackButton to="/dashboard" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Studio libero — {topic}</p>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}>
              {msg.content || (sending && i === messages.length - 1 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null)}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Output buttons (shown after some conversation) */}
      {messages.length >= 4 && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground mb-2">Genera un output dalla sessione:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {OUTPUT_TYPES.map(ot => (
              <button
                key={ot.id}
                onClick={() => generateOutput(ot.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-primary/40 whitespace-nowrap"
              >
                <ot.icon className="w-3 h-3" />
                {ot.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card p-3 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Scrivi..."
          className="flex-1 text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
