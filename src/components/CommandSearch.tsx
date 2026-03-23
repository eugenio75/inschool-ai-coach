import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, FileText, BookOpen, MessageSquare, Zap, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";

interface SearchResult {
  type: "homework" | "memory" | "session" | "action";
  icon: typeof FileText;
  title: string;
  subtitle?: string;
  route: string;
}

export function CommandSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const profileId = getChildSession()?.profileId;

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Search
  useEffect(() => {
    if (!query.trim()) {
      // Show quick actions by default
      setResults([
        { type: "action", icon: Zap, title: "Ripasso flashcard", route: "/memory" },
        { type: "action", icon: MessageSquare, title: "Chat con il coach", route: "/challenge/new?subject=" },
        { type: "action", icon: FileText, title: "Aggiungi compito", route: "/add-homework" },
      ]);
      return;
    }
    searchData(query.trim());
  }, [query]);

  async function searchData(q: string) {
    const items: SearchResult[] = [];
    const lower = q.toLowerCase();

    try {
      // Search homework
      if (profileId) {
        const { data: hw } = await supabase
          .from("homework_tasks")
          .select("id, title, subject")
          .eq("child_profile_id", profileId)
          .or(`title.ilike.%${q}%,subject.ilike.%${q}%`)
          .limit(5);
        
        hw?.forEach(h => items.push({
          type: "homework",
          icon: FileText,
          title: h.title,
          subtitle: h.subject,
          route: `/session/${h.id}`,
        }));
      }

      // Search memory items
      if (profileId) {
        const { data: mem } = await supabase
          .from("memory_items")
          .select("id, concept, subject")
          .eq("child_profile_id", profileId)
          .or(`concept.ilike.%${q}%,subject.ilike.%${q}%`)
          .limit(3);

        mem?.forEach(m => items.push({
          type: "memory",
          icon: BookOpen,
          title: m.concept,
          subtitle: m.subject,
          route: "/memory",
        }));
      }

      // Search conversations
      if (profileId) {
        const { data: conv } = await supabase
          .from("conversation_sessions")
          .select("id, titolo, materia")
          .eq("profile_id", profileId)
          .or(`titolo.ilike.%${q}%,materia.ilike.%${q}%`)
          .limit(3);

        conv?.forEach(c => items.push({
          type: "session",
          icon: MessageSquare,
          title: c.titolo || "Conversazione",
          subtitle: c.materia || undefined,
          route: `/challenge/${c.id}`,
        }));
      }

      // Quick action: study subject
      if (lower.startsWith("studi")) {
        const subject = q.replace(/^studi[a]?\s*/i, "").trim();
        items.push({
          type: "action",
          icon: Zap,
          title: `Studia ${subject || "..."}`,
          route: `/challenge/new?subject=${encodeURIComponent(subject)}`,
        });
      }
    } catch {}

    setResults(items);
    setSelectedIdx(0);
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    navigate(result.route);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Cerca...</span>
        <kbd className="text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5">/</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--color-border)] z-50 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cosa vuoi fare oggi?"
                  className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-bg)]">
                  <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Nessun risultato</p>
                ) : (
                  results.map((r, i) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={`${r.route}-${i}`}
                        onClick={() => handleSelect(r)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-bg)] transition-colors ${
                          i === selectedIdx ? "bg-[var(--color-bg)]" : ""
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text-primary)] truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="text-xs text-[var(--color-text-muted)]">{r.subtitle}</p>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{r.type === "action" ? "Azione" : r.type}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
