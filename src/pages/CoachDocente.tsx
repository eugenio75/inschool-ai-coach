import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Brain, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { streamChat, type ChatMsg } from "@/lib/streamChat";

export default function CoachDocente() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialMessage = (location.state as any)?.initialMessage as string | undefined;
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const classi = useRef<any[]>([]);
  const materialiCount = useRef(0);
  const daSegurireCount = useRef(0);
  const assignmentsCount = useRef(0);

  // Load conversation history, then handle initial message from home
  const initialHandled = useRef(false);
  useEffect(() => {
    if (!profileId) return;
    loadConversation().then(() => {
      if (initialMessage && !initialHandled.current) {
        initialHandled.current = true;
        // Clear the navigation state so refresh doesn't re-send
        window.history.replaceState({}, "");
        handleSend(initialMessage);
      }
    });
    loadContext();
  }, [profileId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadContext() {
    const teacherId = user?.id || profileId;
    const [{ data: c }, { data: mats }, { data: feed }, { data: ta }] = await Promise.all([
      (supabase as any).from("classi").select("*").eq("docente_profile_id", profileId),
      (supabase as any).from("teacher_materials").select("id").eq("teacher_id", teacherId),
      (supabase as any).from("teacher_activity_feed").select("severity, read_at").eq("teacher_id", teacherId),
      (supabase as any).from("teacher_assignments").select("id, due_date").eq("teacher_id", teacherId),
    ]);
    classi.current = c || [];
    materialiCount.current = mats?.length || 0;
    daSegurireCount.current = (feed || []).filter((f: any) => !f.read_at && (f.severity === "warning" || f.severity === "urgent")).length;
    assignmentsCount.current = (ta || []).filter((a: any) => a.due_date).length;
  }

  async function loadConversation() {
    setLoading(true);
    // Find existing coach conversation
    const { data: convs } = await (supabase as any)
      .from("conversation_sessions")
      .select("id, messaggi")
      .eq("profile_id", profileId)
      .eq("ruolo_utente", "docente_coach")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (convs && convs.length > 0) {
      const conv = convs[0];
      setConversationId(conv.id);
      const restored: ChatMsg[] = (conv.messaggi || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(restored);
    }
    setLoading(false);
  }

  async function saveMessages(msgs: ChatMsg[]) {
    if (!profileId) return;
    const payload = {
      profile_id: profileId,
      ruolo_utente: "docente_coach",
      titolo: "Coach",
      messaggi: msgs.map(m => ({ role: m.role, content: m.content })),
      updated_at: new Date().toISOString(),
    };

    if (conversationId) {
      await (supabase as any).from("conversation_sessions").update(payload).eq("id", conversationId);
    } else {
      const { data } = await (supabase as any).from("conversation_sessions").insert(payload).select("id").single();
      if (data) setConversationId(data.id);
    }
  }

  function buildSystemPrompt() {
    return `Sei il coach AI personale di ${profile?.name || "un docente"} su InSchool.
Tono collegiale, efficiente, caldo ma mai paternalistico. Max 2-3 frasi.
NON chiedere mai "Come posso aiutarti?" o "Cosa vuoi fare?". Capisci dal contesto e rispondi.

Contesto attuale:
- Classi: ${classi.current.map((c: any) => `${c.nome} (${c.materia || "N/A"}, ${c.num_studenti || 0} studenti)`).join(", ") || "nessuna"}
- Materiali creati: ${materialiCount.current}
- Segnalazioni aperte: ${daSegurireCount.current}
- Scadenze prossime: ${assignmentsCount.current}

REGOLE DI RISPOSTA:
- Se il messaggio è una risposta al tuo messaggio precedente → continua la conversazione coerentemente
- Se è un saluto → rispondi brevemente e proponi un'azione concreta
- Se è una richiesta operativa → guida verso la funzione
- Se è uno sfogo emotivo → riconosci lo stato, non forzare azioni
- Se è un errore di battitura o testo senza senso → chiedi gentilmente di ripetere in UNA frase sola
- Non rispondere mai con risposte identiche consecutive — varia sempre
- Rispondi SOLO testo, niente JSON.`;
  }

  async function handleSend(overrideMsg?: string) {
    const text = overrideMsg || input.trim();
    if (!text) return;
    if (!overrideMsg) setInput("");

    const userMsg: ChatMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setIsReplying(true);

    const messagesForAI: ChatMsg[] = [
      { role: "assistant", content: buildSystemPrompt() },
      ...updated,
    ];

    try {
      const assistantMsg: ChatMsg = { role: "assistant", content: "" };
      setMessages([...updated, assistantMsg]);

      await streamChat({
        messages: messagesForAI,
        onDelta: (text) => {
          setMessages([...updated, { role: "assistant", content: text }]);
        },
        onDone: (text) => {
          const finalMsgs = [...updated, { role: "assistant" as const, content: text }];
          setMessages(finalMsgs);
          setIsReplying(false);
          saveMessages(finalMsgs);
          // Update home coach cache with latest assistant message
          sessionStorage.setItem("teacher_coach_msg", text);
          sessionStorage.setItem("teacher_coach_msg_at", Date.now().toString());
        },
        extraBody: { model: "google/gemini-2.5-flash" },
      });
    } catch {
      const fallback = [...updated, { role: "assistant" as const, content: "Mi dispiace, non sono riuscito a rispondere. Riprova tra poco." }];
      setMessages(fallback);
      setIsReplying(false);
    }
  }

  async function clearChat() {
    if (conversationId) {
      await (supabase as any).from("conversation_sessions").delete().eq("id", conversationId);
    }
    setMessages([]);
    setConversationId(null);
    sessionStorage.removeItem("teacher_coach_msg");
    sessionStorage.removeItem("teacher_coach_msg_at");
    toast.success("Chat eliminata.");
    setShowDeleteAll(false);
  }

  const quickActions = ["Organizza il lavoro", "Chiedi un suggerimento", "Rivedi le priorità"];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Torna alla home
        </button>
        <h1 className="font-semibold text-foreground">Chat con il coach</h1>
        <button
          onClick={() => setShowDeleteAll(true)}
          className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Elimina chat</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-1/2 ml-auto" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Scrivi un messaggio o usa le azioni rapide per iniziare una conversazione con il coach.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shrink-0 mt-0.5 mr-2">
                  <Brain className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.content || (isReplying && i === messages.length - 1 ? "..." : "")}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card px-4 py-3 space-y-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isReplying && handleSend()}
            placeholder="Scrivi al coach..."
            disabled={isReplying}
            className="flex-1 text-sm border border-input rounded-lg px-3 py-2.5 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isReplying}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((label) => (
            <button
              key={label}
              onClick={() => handleSend(label)}
              disabled={isReplying}
              className="text-xs border border-border hover:border-primary hover:text-primary text-muted-foreground px-3 py-1.5 rounded-lg transition-colors bg-card disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare tutta la chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione cancellerà l'intera cronologia della conversazione con il coach. Non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Elimina tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
