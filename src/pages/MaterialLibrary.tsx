import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, Brain, Layers, Search, Filter, Loader2, Play, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { subjectColors } from "@/lib/mockData";

type MaterialType = "concept" | "flashcard" | "session";

interface MaterialItem {
  id: string;
  type: MaterialType;
  title: string;
  subject: string;
  content: string;
  created_at: string;
  strength?: number;
  source_id?: string;
}

export default function MaterialLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId || "";

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    loadMaterials();
  }, [user, profileId]);

  async function loadMaterials() {
    setLoading(true);
    const allItems: MaterialItem[] = [];

    // Load memory_items (concepts/schemas)
    const { data: concepts } = await supabase
      .from("memory_items")
      .select("*")
      .eq("child_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (concepts) {
      for (const c of concepts) {
        allItems.push({
          id: c.id,
          type: "concept",
          title: c.concept,
          subject: c.subject,
          content: c.summary || "",
          created_at: c.created_at,
          strength: c.strength || 50,
        });
      }
    }

    // Load flashcards
    if (user) {
      const { data: cards } = await supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cards) {
        // Group by subject
        const bySubject: Record<string, any[]> = {};
        for (const c of cards) {
          if (!bySubject[c.subject]) bySubject[c.subject] = [];
          bySubject[c.subject].push(c);
        }
        for (const [subject, group] of Object.entries(bySubject)) {
          allItems.push({
            id: `flashcard-${subject}`,
            type: "flashcard",
            title: `Flashcard di ${subject}`,
            subject,
            content: `${group.length} carte`,
            created_at: group[0].created_at,
          });
        }
      }
    }

    // Load completed guided sessions
    if (user) {
      const { data: sessions } = await supabase
        .from("guided_sessions")
        .select("*, homework_tasks(title, subject)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);

      if (sessions) {
        for (const s of sessions) {
          const hw = (s as any).homework_tasks;
          if (hw) {
            allItems.push({
              id: s.id,
              type: "session",
              title: hw.title,
              subject: hw.subject,
              content: `Completata — Livello Bloom ${s.bloom_level_reached || "?"}`,
              created_at: s.completed_at || s.started_at || "",
              source_id: s.homework_id || undefined,
            });
          }
        }
      }
    }

    setItems(allItems);
    setLoading(false);
  }

  const subjects = useMemo(() => {
    const s = new Set(items.map(i => i.subject));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (subjectFilter !== "all" && i.subject !== subjectFilter) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q) || i.subject.toLowerCase().includes(q) || i.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, subjectFilter, typeFilter, searchQuery]);

  const typeIcon = (type: MaterialType) => {
    switch (type) {
      case "concept": return <Brain className="w-4 h-4" />;
      case "flashcard": return <Layers className="w-4 h-4" />;
      case "session": return <FileText className="w-4 h-4" />;
    }
  };

  const typeLabel = (type: MaterialType) => {
    switch (type) {
      case "concept": return "Concetto";
      case "flashcard": return "Flashcard";
      case "session": return "Sessione";
    }
  };

  const handleAction = (item: MaterialItem) => {
    switch (item.type) {
      case "concept":
        navigate("/memory");
        break;
      case "flashcard":
        navigate("/memory");
        break;
      case "session":
        if (item.source_id) navigate(`/homework/${item.source_id}`);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border px-6 pt-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Libreria Materiali</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">I tuoi materiali</h1>
          <p className="text-muted-foreground text-sm">Schemi, flashcard e sessioni completate in un unico posto</p>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nei materiali..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
              {[
                { key: "all", label: "Tutti" },
                { key: "concept", label: "Concetti" },
                { key: "flashcard", label: "Flashcard" },
                { key: "session", label: "Sessioni" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTypeFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject pills */}
          {subjects.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSubjectFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  subjectFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Tutte le materie
              </button>
              {subjects.map(s => {
                const colors = subjectColors[s] || subjectColors.Matematica;
                return (
                  <button
                    key={s}
                    onClick={() => setSubjectFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                      subjectFilter === s ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-5 pb-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {items.length === 0 ? "Nessun materiale ancora" : "Nessun risultato"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {items.length === 0 ? "Completa sessioni di studio per popolare la libreria" : "Prova a modificare i filtri"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const colors = subjectColors[item.subject] || subjectColors.Matematica;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleAction(item)}
                >
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={colors.text}>{typeIcon(item.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{typeLabel(item.type)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className={`text-[10px] font-semibold ${colors.text}`}>{item.subject}</span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm truncate">{item.title}</h3>
                    {item.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.content}</p>
                    )}
                    {item.strength !== undefined && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-24">
                          <div
                            className={`h-full rounded-full ${item.strength >= 70 ? "bg-primary" : item.strength >= 40 ? "bg-secondary" : "bg-destructive"}`}
                            style={{ width: `${item.strength}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.strength}%</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
                    <Play className="w-4 h-4 text-primary" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
