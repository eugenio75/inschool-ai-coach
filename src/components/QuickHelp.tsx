import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, HelpCircle } from "lucide-react";
import { getChildSession, isChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

import { Lightbulb, Compass, Target } from "lucide-react";

const quickModes = [
  { id: "explain", icon: Lightbulb, label: "Spiegami una cosa" },
  { id: "guide", icon: Compass, label: "Guidami passo passo" },
  { id: "quiz", icon: Target, label: "Mini quiz veloce" },
];

export const QuickHelpButton = ({ onClick }: { onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-sage-dark transition-colors"
  >
    <HelpCircle className="w-4 h-4" />
    Aiuto veloce
  </motion.button>
);

export const QuickHelpModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !mode) {
      setMessages([]);
      setInput("");
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const childSession = getChildSession();
      const profile = childSession?.profile;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const body: Record<string, any> = {
        messages: [...messages, userMsg].map(m => ({ role: m.role, text: m.text })),
        mode: mode || "explain",
        studentName: profile?.name || "studente",
        schoolLevel: profile?.school_level || "",
      };

      if (childSession) {
        body.accessCode = childSession.accessCode;
        body.childProfileId = childSession.profileId;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );

      if (!response.ok) throw new Error("Errore");

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        setMessages(prev => [...prev, { role: "assistant", text: "" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantText += content;
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", text: assistantText };
                  return copy;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Mi dispiace, c'è stato un problema. Riprova!" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleModeSelect = (modeId: string) => {
    setMode(modeId);
    const prompts: Record<string, string> = {
      explain: "Ciao! Di cosa hai bisogno che ti spieghi? Dimmi l'argomento o la materia.",
      guide: "Ciao! Dimmi cosa devi fare e ti guido passo per passo.",
      quiz: "Ciao! Su che argomento vuoi fare un mini quiz veloce?",
    };
    setMessages([{ role: "assistant", text: prompts[modeId] || prompts.explain }]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span className="font-display font-semibold text-foreground">Aiuto Veloce</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode selector or chat */}
          {!mode ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                <h2 className="font-display text-xl font-bold text-foreground mb-2 text-center">
                  Come posso aiutarti?
                </h2>
                <p className="text-sm text-muted-foreground mb-8 text-center">
                  Scegli il tipo di aiuto di cui hai bisogno
                </p>
                <div className="flex flex-col gap-3 max-w-xs w-full mx-auto">
                  {quickModes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleModeSelect(m.id)}
                      className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/30 transition-all text-left w-full"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><m.icon className="w-5 h-5 text-primary" /></div>
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border rounded-2xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border bg-card">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                    placeholder="Scrivi la tua domanda..."
                    className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
