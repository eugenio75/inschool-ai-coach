import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { it, enUS } from "date-fns/locale";

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
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "en" ? enUS : it;
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
  const [coachName, setCoachName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialHandled = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatsRef = useRef<TeacherChat[]>([]);

  // Load coach name
  useEffect(() => {
    if (!profileId) return;
    supabase.from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.data as any) || {};
        if (prefs.coach_name) setCoachName(prefs.coach_name);
      });
  }, [profileId]);
  chatsRef.current = chats;

  // Load sidebar data
  useEffect(() => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadSidebarData();
  }, [teacherId]);

  // Handle initial message — triggered after sidebar finishes loading
  const pendingInitialMessage = useRef(initialMessage);
  const pendingInitialClassId = useRef(initialClassId);
  
  async function processInitialMessage() {
    const msg = pendingInitialMessage.current;
    const clsId = pendingInitialClassId.current;
    if (!msg || initialHandled.current || !teacherId) return;
    initialHandled.current = true;
    pendingInitialMessage.current = undefined;
    window.history.replaceState({}, "");
    await handleInitialMessage(msg, clsId);
  }

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
    try {
      const [{ data: cls }, { data: cts }] = await Promise.all([
        (supabase as any).from("classi").select("id, nome, materia, num_studenti")
          .eq("docente_profile_id", profileId).order("created_at", { ascending: true }),
        (supabase as any).from("teacher_chats").select("*")
          .eq("teacher_id", teacherId).order("updated_at", { ascending: false }),
      ]);

      setClasses(cls || []);
      const loadedChats = (cts || []) as TeacherChat[];
      let mergedChats = loadedChats;
      setChats(loadedChats);

      const existingClassIds = new Set(loadedChats.filter(c => c.class_id).map(c => c.class_id));
      const missingClasses = (cls || []).filter((c: ClassInfo) => !existingClassIds.has(c.id));
      if (missingClasses.length > 0) {
        const inserts = missingClasses.map((c: ClassInfo) => ({
          teacher_id: teacherId,
          class_id: c.id,
          name: `${c.nome}${c.materia ? ` — ${c.materia}` : ""}`,
        }));
        const { data: newChats } = await (supabase as any).from("teacher_chats").insert(inserts).select("*");
        if (newChats?.length) {
          mergedChats = [...newChats, ...loadedChats] as TeacherChat[];
          setChats(mergedChats);
        }
      }

      if (initialClassId) {
        const classChat = mergedChats.find(c => c.class_id === initialClassId);
        if (classChat) {
          setActiveChatId(classChat.id);
          await loadMessages(classChat.id);
        } else {
          setMessages([]);
        }
      } else if (!activeChatId && mergedChats.length > 0 && !initialMessage) {
        setActiveChatId(mergedChats[0].id);
        await loadMessages(mergedChats[0].id);
      } else if (!activeChatId && !initialMessage) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }

    await processInitialMessage();
  }

  async function loadMessages(chatId: string) {
    const { data, error } = await (supabase as any).from("teacher_chat_messages")
      .select("*").eq("chat_id", chatId).order("created_at", { ascending: true });

    if (error) {
      console.error("Errore caricamento messaggi:", error);
      setMessages([]);
      return;
    }

    setMessages((data || []) as ChatMessage[]);
  }

  async function selectChat(chatId: string) {
    setActiveChatId(chatId);
    await loadMessages(chatId);
    if (isMobile) setSidebarOpen(false);
  }

  async function createNewChat(name?: string) {
    if (!teacherId) return null;
    const chatName = name || `Chat del ${format(new Date(), "d MMMM", { locale: dateLocale })}`;
    const { data, error } = await (supabase as any).from("teacher_chats")
      .insert({ teacher_id: teacherId, name: chatName, class_id: null }).select("*").single();

    if (error) {
      console.error("Errore creazione chat:", error);
      return null;
    }

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
    let chatId: string | null = null;

    if (classId) {
      const existing = chatsRef.current.find(c => c.class_id === classId);
      if (existing) {
        chatId = existing.id;
        setActiveChatId(chatId);
        await loadMessages(chatId);
      }
    } else {
      const newChat = await createNewChat();
      if (newChat) {
        chatId = newChat.id;
      }
    }

    if (!chatId) return;
    await sendMessage(text, chatId);
  }

  function buildSystemPrompt(chatId?: string) {
    const activeChat = chats.find(c => c.id === (chatId || activeChatId));
    const isClassChat = !!activeChat?.class_id;
    const className = activeChat?.name || "";
    const subjects = profile?.favorite_subjects || [];

    const isEN = i18n.language === "en";
    let base = isEN
      ? `You are the personal AI coach of ${profile?.name || "a teacher"} on InSchool.
${subjects.length > 0 ? `Subjects taught: ${subjects.join(", ")}.` : ""}
Collegial, efficient, warm but never patronising tone. Max 2-3 sentences.
NEVER ask "How can I help you?" or "What do you want to do?". Understand from context and respond.`
      : `Sei il coach AI personale di ${profile?.name || "un docente"} su InSchool.
${subjects.length > 0 ? `Materie insegnate: ${subjects.join(", ")}.` : ""}
Tono collegiale, efficiente, caldo ma mai paternalistico. Max 2-3 frasi.
NON chiedere mai "Come posso aiutarti?" o "Cosa vuoi fare?". Capisci dal contesto e rispondi.`;

    if (isClassChat) {
      base += isEN
        ? `\n\nThis is a class chat: ${className}. Always respond in the context of the class, its students and related activities.`
        : `\n\nQuesta è una chat di classe: ${className}. Rispondi sempre in contesto con la classe, i suoi studenti e le attività correlate.`;
    }

    base += isEN
      ? `\n\nRESPONSE RULES:
- If the message is a reply to your previous message → continue the conversation coherently
- If it's a greeting → respond briefly and suggest a concrete action
- If it's an operational request → guide toward the feature
- If it's an emotional vent → acknowledge the state, don't force actions
- If it's a typo or nonsensical text → gently ask to repeat in ONE sentence
- Never respond with identical consecutive replies — always vary
- Respond ONLY text, no JSON.`
      : `\n\nREGOLE DI RISPOSTA:
- Se il messaggio è una risposta al tuo messaggio precedente → continua la conversazione coerentemente
- Se è un saluto → rispondi brevemente e proponi un'azione concreta
- Se è una richiesta operativa → guida verso la funzione
- Se è uno sfogo emotivo → riconosci lo stato, non forzare azioni
- Se è un errore di battitura o testo senza senso → chiedi gentilmente di ripetere in UNA frase sola
- Non rispondere mai con risposte identiche consecutive — varia sempre
- Rispondi SOLO testo, niente JSON.`;

    return base;
  }

  // Use a ref to always have latest messages for closures
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  async function sendMessage(text: string, overrideChatId?: string) {
    let chatId = overrideChatId || activeChatId;
    if (!text.trim()) return;
    setInput("");

    if (!chatId) {
      const newChat = await createNewChat();
      if (!newChat) return;
      chatId = newChat.id;
    }

    const { data: userMsgData, error: insertError } = await (supabase as any).from("teacher_chat_messages")
      .insert({ chat_id: chatId, role: "user", content: text.trim() }).select("*").single();

    if (insertError) {
      console.error("Errore inserimento messaggio:", insertError);
      return;
    }

    const userMsg = userMsgData as ChatMessage;
    const currentMessages = [...messagesRef.current, userMsg];
    setMessages(currentMessages);
    setIsReplying(true);

    const placeholder: ChatMessage = {
      id: "temp-assistant",
      chat_id: chatId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages([...currentMessages, placeholder]);

    const aiMessages: ChatMsg[] = [
      { role: "assistant", content: buildSystemPrompt(chatId) },
      ...currentMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    try {
      await streamChat({
        messages: aiMessages,
        onDelta: (fullSoFar) => {
          setMessages([...currentMessages, { ...placeholder, content: fullSoFar }]);
        },
        onDone: async (fullText) => {
          const { data: asstData, error: replyError } = await (supabase as any).from("teacher_chat_messages")
            .insert({ chat_id: chatId, role: "assistant", content: fullText }).select("*").single();

          if (replyError) {
            console.error("Errore inserimento risposta coach:", replyError);
            setMessages([...currentMessages, { ...placeholder, content: fullText }]);
          } else {
            setMessages([...currentMessages, asstData as ChatMessage]);
          }

          setIsReplying(false);
          await (supabase as any).from("teacher_chats")
            .update({ updated_at: new Date().toISOString() }).eq("id", chatId);
          sessionStorage.setItem("teacher_coach_msg", fullText);
          sessionStorage.setItem("teacher_coach_msg_at", Date.now().toString());
        },
        extraBody: { model: "google/gemini-2.5-flash" },
      });
    } catch {
      const fallbackMsg: ChatMessage = {
        ...placeholder,
        content: t("coach_fallback"),
      };
      setMessages([...currentMessages, fallbackMsg]);
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
      toast.success(t("coach_messages_deleted"));
    } else {
      // General chat: delete entirely
      await (supabase as any).from("teacher_chats").delete().eq("id", activeChatId);
      setChats(prev => prev.filter(c => c.id !== activeChatId));
      setActiveChatId(null);
      setMessages([]);
      toast.success(t("coach_chat_deleted"));
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
    toast.success(t("coach_chat_deleted"));
  }

  const activeChat = chats.find(c => c.id === activeChatId);
  const classChats = chats.filter(c => c.class_id);
  const generalChats = chats.filter(c => !c.class_id);

  const quickActions = [t("coach_quick_organize"), t("coach_quick_suggest"), t("coach_quick_review")];

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
          <Plus className="w-4 h-4" /> {t("coach_new_chat")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {/* Class chats */}
        {classChats.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 px-2 mb-1.5">
              {t("coach_your_classes")}
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
              {t("coach_conversations")}
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
                  <span className="truncate flex-1">{chat.name || t("coach_unnamed_chat")}</span>
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
              <span className="hidden sm:inline">{t("coach_back_home")}</span>
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
                {activeChat?.name || (coachName ? `${t("coach_chat_with")} ${coachName}` : t("coach_chat_with"))}
              </button>
            )}
          </div>

          {activeChatId && (
            <button
              onClick={() => setShowDeleteChat(true)}
              className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("coach_delete")}</span>
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
              <p className="text-lg font-medium text-foreground">{t("coach_how_help")}</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => {
                return (
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
                );
              })}
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
                placeholder={t("coach_write_placeholder")}
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
              {activeChat?.class_id ? t("coach_clear_class_title") : t("coach_delete_chat_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeChat?.class_id
                ? t("coach_clear_class_body")
                : t("coach_delete_chat_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("coach_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteChat} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {activeChat?.class_id ? t("coach_clear_messages") : t("coach_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
