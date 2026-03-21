import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Send, Mic, MicOff, Sparkles, Plus, Trash2,
  MessageSquare, PanelLeftClose, PanelLeftOpen, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationSession {
  id: string;
  profile_id: string;
  titolo: string | null;
  materia: string | null;
  ruolo_utente: string | null;
  messaggi: ChatMessage[];
  created_at: string;
  updated_at: string;
}

function getProfile() {
  try {
    if (isChildSession()) {
      return getChildSession()?.profile || null;
    }
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function getSystemPrompt(profile: any, subject?: string): string {
  const role = profile?.school_level || profile?.schoolLevel || "alunno";
  const name = profile?.name || "studente";
  let prompt = `Sei l'AI InSchool, un assistente educativo. Lo studente si chiama ${name}.\n\n`;

  if (role === "alunno") {
    prompt += `RUOLO: Tutor per Bambini (Elementari/Medie). Usa un linguaggio semplice, dolce e incoraggiante. Non dare mai la soluzione pronta, guida con domande socratiche e piccoli passi.`;
  } else if (role === "superiori") {
    prompt += `RUOLO: Mentore per Scuole Superiori. Sfida lo studente a ragionare, usa un tono maturo e motivazionale. Non dare quasi mai la soluzione pronta.`;
  } else if (role === "universitario") {
    prompt += `RUOLO: Assistente di Ricerca Universitario. Fornisci contenuti ad alta densità concettuale. Parla come un ricercatore esperto.`;
  } else if (role === "docente") {
    prompt += `RUOLO: Co-pilota Strategico per Docenti. Aiuta con rubriche, verifiche, piani di lezione. Tono professionale e collaborativo.`;
  }

  if (subject) prompt += `\n\nMateria/Argomento corrente: ${subject}.`;
  return prompt;
}

export default function CoachChallenge() {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const [searchParams] = useSearchParams();
  const subject = searchParams.get("subject") || "";

  const profile = getProfile();
  const profileId = getChildSession()?.profileId || profile?.id;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Conversation sessions
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom system prompt from localStorage (e.g. from dashboard AI actions)
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("inschool-ai-prompt");
    if (stored) {
      setCustomSystemPrompt(stored);
      localStorage.removeItem("inschool-ai-prompt");
    }
  }, []);

  // Load session from query param
  const sessionIdParam = searchParams.get("session");

  // Load conversation list
  useEffect(() => {
    if (!profileId) return;
    loadSessions();
  }, [profileId]);

  // Load specific session if param
  useEffect(() => {
    if (sessionIdParam && sessions.length > 0) {
      const found = sessions.find(s => s.id === sessionIdParam);
      if (found) {
        setActiveSessionId(found.id);
        setMessages((found.messaggi as ChatMessage[]) || []);
      }
    }
  }, [sessionIdParam, sessions]);

  async function loadSessions() {
    setLoadingSessions(true);
    const { data } = await (supabase as any)
      .from("conversation_sessions")
      .select("*")
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(50);
    setSessions((data || []) as ConversationSession[]);
    setLoadingSessions(false);
  }

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  // Debounced save
  const saveMessages = useCallback((sessionId: string, msgs: ChatMessage[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await (supabase as any)
        .from("conversation_sessions")
        .update({ messaggi: msgs, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }, 500);
  }, []);

  async function createSession(firstMessage: string): Promise<string | null> {
    if (!profileId) return null;
    const role = profile?.school_level || profile?.schoolLevel || "alunno";

    // Create session
    const { data, error } = await (supabase as any)
      .from("conversation_sessions")
      .insert({
        profile_id: profileId,
        materia: subject || null,
        ruolo_utente: role,
        messaggi: [],
      })
      .select()
      .single();

    if (error || !data) return null;

    // Generate title async
    generateTitle(data.id, firstMessage);

    setSessions(prev => [data as ConversationSession, ...prev]);
    return data.id;
  }

  async function generateTitle(sessionId: string, firstMessage: string) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ generateTitle: firstMessage }),
        }
      );
      if (res.ok) {
        const { title } = await res.json();
        await (supabase as any)
          .from("conversation_sessions")
          .update({ titolo: title })
          .eq("id", sessionId);
        setSessions(prev =>
          prev.map(s => (s.id === sessionId ? { ...s, titolo: title } : s))
        );
      }
    } catch { /* silent */ }
  }

  // Speech recognition
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
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

  const streamReply = async (allMessages: ChatMessage[]) => {
    setIsTyping(true);
    setStreamingText("");

    const systemPrompt = customSystemPrompt || getSystemPrompt(profile, subject);
    const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            systemPrompt,
            messages: apiMessages,
            stream: true,
            profileId: profileId || undefined,
            subject: subject || undefined,
          }),
        }
      );

      if (!response.ok || !response.body) throw new Error("AI error");

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
          if (line.trim() === "" || line === "data: [DONE]") continue;
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6).trim());
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setStreamingText(assistantText);
            }
          } catch { /* partial chunk */ }
        }
      }

      if (assistantText) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: assistantText,
          timestamp: new Date().toISOString(),
        };
        const updated = [...allMessages, assistantMsg];
        setMessages(updated);
        if (activeSessionId) saveMessages(activeSessionId, updated);
      }
    } catch (err) {
      console.error("AI error:", err);
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Mi dispiace, c'è stato un problema di connessione. Riprova tra poco.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setStreamingText("");
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");

    // Create session on first message
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession(trimmed);
      if (sessionId) {
        setActiveSessionId(sessionId);
        saveMessages(sessionId, updated);
      }
    } else {
      saveMessages(sessionId, updated);
    }

    streamReply(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setCustomSystemPrompt(null);
    setSidebarOpen(false);
  };

  const loadSession = (session: ConversationSession) => {
    setActiveSessionId(session.id);
    setMessages((session.messaggi as ChatMessage[]) || []);
    setCustomSystemPrompt(null);
    setSidebarOpen(false);
  };

  const deleteSession = async (id: string) => {
    await (supabase as any).from("conversation_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) startNewChat();
    setDeleteTarget(null);
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <h2 className="font-display font-semibold text-foreground text-sm">Conversazioni</h2>
        <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors lg:hidden">
          <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="p-3">
        <Button onClick={startNewChat} variant="outline" className="w-full text-sm" size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nuova chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loadingSessions ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nessuna conversazione</p>
        ) : (
          <div className="space-y-0.5">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  activeSessionId === s.id
                    ? "bg-card border-l-2 border-primary shadow-soft"
                    : "text-foreground hover:bg-card"
                }`}
              >
                <button
                  onClick={() => loadSession(s)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium truncate">
                    {s.titolo || "Nuova conversazione"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.materia && <span className="mr-1.5">{s.materia}</span>}
                    {formatDistanceToNow(new Date(s.updated_at), { locale: it, addSuffix: true })}
                  </p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id); }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* DESKTOP SIDEBAR — always visible on lg+ */}
      <aside className="hidden lg:flex w-72 bg-card border-r border-border flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* MOBILE SIDEBAR — overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRM */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la conversazione?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteSession(deleteTarget)} className="rounded-xl bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors lg:hidden"
              >
                <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h1 className="font-display text-sm font-bold text-foreground">
                    {activeSessionId
                      ? sessions.find(s => s.id === activeSessionId)?.titolo || "Chat AI"
                      : "Nuova Chat"}
                  </h1>
                </div>
                {subject && <p className="text-xs text-muted-foreground">{subject}</p>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={startNewChat} className="rounded-xl text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nuova
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-foreground">Come posso aiutarti?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {subject ? `Chiedi qualsiasi cosa su ${subject}` : "Scrivi un messaggio per iniziare"}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-muted text-foreground rounded-bl-md"
                      : "bg-primary text-primary-foreground rounded-br-md"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="max-w-[85%] bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-primary/40 ml-0.5 animate-pulse" />
                </div>
              </motion.div>
            )}

            {isTyping && !streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </div>
        </div>

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
              placeholder="Scrivi un messaggio..."
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
    </div>
  );
}
