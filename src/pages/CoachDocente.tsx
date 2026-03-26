import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Brain, Send, Trash2, Plus, Pencil, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { streamChat, type ChatMsg } from "@/lib/streamChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TeacherChat {
  id: string;
  teacher_id: string;
  class_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ClassInfo {
  id: string;
  nome: string;
  materia: string | null;
  num_studenti: number | null;
}

export default function CoachDocente() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as any;
  const initialMessage = locState?.initialMessage as string | undefined;
  const initialClassId = locState?.classId as string | undefined;

  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;
  const { user } = useAuth();
  const teacherId = user?.id;
  const isMobile = useIsMobile();

  const [chats, setChats] = useState<TeacherChat[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteChat, setShowDeleteChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialHandled = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatsRef = useRef<TeacherChat[]>([]);
  chatsRef.current = chats;

  // Load sidebar data
  useEffect(() => {
    if (!teacherId) return;
    loadSidebarData();
  }, [teacherId]);

  // Handle initial message
  useEffect(() => {
    if (!teacherId || loading) return;
    if (initialMessage && !initialHandled.current) {
      initialHandled.current = true;
      window.history.replaceState({}, "");
      handleInitialMessage(initialMessage, initialClassId);
    }
  }, [teacherId, loading]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  async function loadSidebarData() {
    setLoading(true);
    const [{ data: cls }, { data: cts }] = await Promise.all([
      (supabase as any).from("classi").select("id, nome, materia, num_studenti")
        .eq("docente_profile_id", profileId).order("created_at", { ascending: true }),
      (supabase as any).from("teacher_chats").select("*")
        .eq("teacher_id", teacherId).order("updated_at", { ascending: false }),
    ]);
    setClasses(cls || []);
    const loadedChats = (cts || []) as TeacherChat[];
    setChats(loadedChats);

    // Auto-create class chats if missing
    const existingClassIds = new Set(loadedChats.filter(c => c.class_id).map(c => c.class_id));
    const missingClasses = (cls || []).filter((c: ClassInfo) => !existingClassIds.has(c.id));
    if (missingClasses.length > 0) {
      const inserts = missingClasses.map((c: ClassInfo) => ({
        teacher_id: teacherId,
        class_id: c.id,
        name: `${c.nome}${c.materia ? ` — ${c.materia}` : ""}`,
      }));
      const { data: newChats } = await (supabase as any).from("teacher_chats").insert(inserts).select("*");
      if (newChats) {
        setChats(prev => [...newChats, ...prev]);
      }
    }

    // Select initial chat or first available
    if (initialClassId) {
      const classChat = loadedChats.find(c => c.class_id === initialClassId);
      if (classChat) {
        setActiveChatId(classChat.id);
        await loadMessages(classChat.id);
      }
    } else if (!activeChatId && loadedChats.length > 0) {
      // Don't auto-select if we're about to create from initialMessage
      if (!initialMessage) {
        setActiveChatId(loadedChats[0].id);
        await loadMessages(loadedChats[0].id);
      }
    }
    setLoading(false);
  }

  async function loadMessages(chatId: string) {
    const { data } = await (supabase as any).from("teacher_chat_messages")
      .select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
    setMessages((data || []) as ChatMessage[]);
  }

  async function selectChat(chatId: string) {
    setActiveChatId(chatId);
    await loadMessages(chatId);
    if (isMobile) setSidebarOpen(false);
  }

  async function createNewChat(name?: string) {
    if (!teacherId) return null;
    const chatName = name || `Chat del ${format(new Date(), "d MMMM", { locale: it })}`;
    const { data } = await (supabase as any).from("teacher_chats")
      .insert({ teacher_id: teacherId, name: chatName }).select("*").single();
    if (data) {
      setChats(prev => [data, ...prev]);
      setActiveChatId(data.id);
      setMessages([]);
      if (isMobile) setSidebarOpen(false);
      return data as TeacherChat;
    }
    return null;
  }

  async function handleInitialMessage(text: string, classId?: string) {
    let chatId: string;
    if (classId) {
      // Find or wait for class chat
      const existing = chats.find(c => c.class_id === classId);
      if (existing) {
        chatId = existing.id;
        setActiveChatId(chatId);
        await loadMessages(chatId);
      } else {
        return;
      }
    } else {
      // Create new general chat
      const newChat = await createNewChat();
      if (!newChat) return;
      chatId = newChat.id;
    }
    sendMessage(text, chatId);
  }

  function buildSystemPrompt(chatId?: string) {
    const activeChat = chats.find(c => c.id === (chatId || activeChatId));
    const isClassChat = !!activeChat?.class_id;
    const className = activeChat?.name || "";

    let base = `Sei il coach AI personale di ${profile?.name || "un docente"} su InSchool.
Tono collegiale, efficiente, caldo ma mai paternalistico. Max 2-3 frasi.
NON chiedere mai "Come posso aiutarti?" o "Cosa vuoi fare?". Capisci dal contesto e rispondi.`;

    if (isClassChat) {
      base += `\n\nQuesta è una chat di classe: ${className}. Rispondi sempre in contesto con la classe, i suoi studenti e le attività correlate.`;
    }

    base += `\n\nREGOLE DI RISPOSTA:
- Se il messaggio è una risposta al tuo messaggio precedente → continua la conversazione coerentemente
- Se è un saluto → rispondi brevemente e proponi un'azione concreta
- Se è una richiesta operativa → guida verso la funzione
- Se è uno sfogo emotivo → riconosci lo stato, non forzare azioni
- Se è un errore di battitura o testo senza senso → chiedi gentilmente di ripetere in UNA frase sola
- Non rispondere mai con risposte identiche consecutive — varia sempre
- Rispondi SOLO testo, niente JSON.`;

    return base;
  }

  async function sendMessage(text: string, overrideChatId?: string) {
    const chatId = overrideChatId || activeChatId;
    if (!text.trim() || !chatId) return;
    setInput("");

    // Save user message
    const { data: userMsgData } = await (supabase as any).from("teacher_chat_messages")
      .insert({ chat_id: chatId, role: "user", content: text.trim() }).select("*").single();

    const userMsg = userMsgData as ChatMessage;
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsReplying(true);

    // Add placeholder for assistant
    const placeholder: ChatMessage = {
      id: "temp",
      chat_id: chatId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages([...updatedMessages, placeholder]);

    const aiMessages: ChatMsg[] = [
      { role: "assistant", content: buildSystemPrompt(chatId) },
      ...updatedMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    try {
      await streamChat({
        messages: aiMessages,
        onDelta: (fullSoFar) => {
          setMessages([...updatedMessages, { ...placeholder, content: fullSoFar }]);
        },
        onDone: async (fullText) => {
          // Save assistant message
          const { data: asstData } = await (supabase as any).from("teacher_chat_messages")
            .insert({ chat_id: chatId, role: "assistant", content: fullText }).select("*").single();
          const asstMsg = asstData as ChatMessage;
          setMessages([...updatedMessages, asstMsg]);
          setIsReplying(false);

          // Update chat updated_at
          await (supabase as any).from("teacher_chats")
            .update({ updated_at: new Date().toISOString() }).eq("id", chatId);

          // Update home coach cache
          sessionStorage.setItem("teacher_coach_msg", fullText);
          sessionStorage.setItem("teacher_coach_msg_at", Date.now().toString());
        },
        extraBody: { model: "google/gemini-2.5-flash" },
      });
    } catch {
      const fallbackMsg: ChatMessage = {
        ...placeholder,
        content: "Mi dispiace, non sono riuscito a rispondere. Riprova tra poco.",
      };
      setMessages([...updatedMessages, fallbackMsg]);
      setIsReplying(false);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    if (!activeChatId) {
      const newChat = await createNewChat();
      if (newChat) {
        sendMessage(input.trim(), newChat.id);
      }
    } else {
      sendMessage(input.trim());
    }
  }

  async function deleteChat() {
    if (!activeChatId) return;
    const chat = chats.find(c => c.id === activeChatId);
    if (chat?.class_id) {
      // Class chat: just delete messages, keep the chat
      await (supabase as any).from("teacher_chat_messages").delete().eq("chat_id", activeChatId);
      setMessages([]);
      toast.success("Messaggi eliminati.");
    } else {
      // General chat: delete entirely
      await (supabase as any).from("teacher_chats").delete().eq("id", activeChatId);
      setChats(prev => prev.filter(c => c.id !== activeChatId));
      setActiveChatId(null);
      setMessages([]);
      toast.success("Chat eliminata.");
    }
    setShowDeleteChat(false);
  }

  async function renameChat(newName: string) {
    if (!activeChatId || !newName.trim()) return;
    await (supabase as any).from("teacher_chats")
      .update({ name: newName.trim() }).eq("id", activeChatId);
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, name: newName.trim() } : c));
    setEditingName(false);
  }

  async function deleteGeneralChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await (supabase as any).from("teacher_chats").delete().eq("id", chatId);
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
    toast.success("Chat eliminata.");
  }

  const activeChat = chats.find(c => c.id === activeChatId);
  const classChats = chats.filter(c => c.class_id);
  const generalChats = chats.filter(c => !c.class_id);

  const quickActions = ["Organizza il lavoro", "Chiedi un suggerimento", "Rivedi le priorità"];

  // --- SIDEBAR ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="p-3">
        <Button
          onClick={() => createNewChat()}
          className="w-full gap-2 justify-start"
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4" /> Nuova chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {/* Class chats */}
        {classChats.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 px-2 mb-1.5">
              Le tue classi
            </p>
            {classChats.map(chat => {
              const cls = classes.find(c => c.id === chat.class_id);
              return (
                <button
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                    activeChatId === chat.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{cls?.nome || chat.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* General chats */}
        {generalChats.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 px-2 mb-1.5">
              Conversazioni
            </p>
            {generalChats.map(chat => {
              return (
                <div
                  key={chat.id}
                  className={cn(
                    "group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer",
                    activeChatId === chat.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  onClick={() => selectChat(chat.id)}
                >
                  <span className="truncate flex-1">{chat.name || "Chat senza nome"}</span>
                  <button
                    onClick={(e) => deleteGeneralChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar — desktop */}
      {!isMobile && (
        <div className="w-[260px] shrink-0 border-r border-border bg-muted/30 flex flex-col">
          {sidebarContent}
        </div>
      )}

      {/* Mobile drawer overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[280px] bg-card border-r border-border flex flex-col z-10">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="font-semibold text-sm text-foreground">Chat</span>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground mr-1">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Torna alla home</span>
            </button>
          </div>

          {/* Center: chat name (editable) */}
          <div className="flex-1 flex justify-center mx-4 min-w-0">
            {editingName ? (
              <Input
                autoFocus
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={() => renameChat(editNameValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameChat(editNameValue);
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="max-w-[200px] h-8 text-center text-sm"
              />
            ) : (
              <button
                onClick={() => {
                  if (activeChat) {
                    setEditNameValue(activeChat.name);
                    setEditingName(true);
                  }
                }}
                className="font-semibold text-foreground text-sm truncate max-w-[200px] hover:text-primary transition-colors"
              >
                {activeChat?.name || "Chat con il coach"}
              </button>
            )}
          </div>

          {activeChatId && (
            <button
              onClick={() => setShowDeleteChat(true)}
              className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Elimina</span>
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 bg-muted/20">
          {loading ? (
            <div className="space-y-3 max-w-2xl mx-auto">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-10 w-1/2 ml-auto" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : !activeChatId || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">Come posso aiutarti oggi?</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={msg.id || i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <Brain className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="max-w-[80%] space-y-1">
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm shadow-sm border border-border"
                    )}>
                      {msg.content || (isReplying && i === messages.length - 1 ? (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      ) : "")}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 px-1">
                      {format(new Date(msg.created_at), "HH:mm", { locale: it })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card px-4 sm:px-8 py-3 shrink-0">
          <div className="max-w-2xl mx-auto space-y-2.5">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isReplying) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Scrivi al coach..."
                disabled={isReplying}
                rows={1}
                className="flex-1 text-sm border border-input rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-50 transition-colors resize-none overflow-hidden"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isReplying}
                className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground p-2.5 rounded-xl transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    setInput(label);
                    // Use setTimeout to allow state update before sending
                    setTimeout(() => {
                      if (!activeChatId) {
                        createNewChat().then(chat => {
                          if (chat) sendMessage(label, chat.id);
                        });
                      } else {
                        sendMessage(label);
                      }
                    }, 0);
                  }}
                  disabled={isReplying}
                  className="text-xs border border-border hover:border-primary hover:text-primary text-muted-foreground px-3 py-1.5 rounded-lg transition-colors bg-card disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteChat} onOpenChange={setShowDeleteChat}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activeChat?.class_id ? "Svuotare la chat della classe?" : "Eliminare questa chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeChat?.class_id
                ? "Tutti i messaggi della chat di classe verranno eliminati. La chat resterà disponibile."
                : "Questa azione cancellerà l'intera conversazione. Non è reversibile."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deleteChat} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {activeChat?.class_id ? "Svuota messaggi" : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
