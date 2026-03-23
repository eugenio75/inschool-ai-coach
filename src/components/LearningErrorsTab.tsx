import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, Brain, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subjectColors } from "@/lib/mockData";

interface LearningError {
  id: string;
  subject: string | null;
  topic: string | null;
  error_type: string | null;
  description: string | null;
  resolved: boolean;
  created_at: string;
}

const errorTypeLabels: Record<string, { label: string; color: string }> = {
  distrazione: { label: "Distrazione", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  incomprensione: { label: "Incomprensione", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  metodo: { label: "Metodo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  memoria: { label: "Memoria", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ragionamento: { label: "Ragionamento", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  fretta: { label: "Fretta", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
};

export function LearningErrorsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [errors, setErrors] = useState<LearningError[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");

  useEffect(() => {
    if (!user) return;
    loadErrors();
  }, [user]);

  async function loadErrors() {
    setLoading(true);
    const { data } = await supabase
      .from("learning_errors")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setErrors(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (filter === "open") return errors.filter(e => !e.resolved);
    if (filter === "resolved") return errors.filter(e => e.resolved);
    return errors;
  }, [errors, filter]);

  // Group by subject
  const grouped = useMemo(() => {
    const map: Record<string, LearningError[]> = {};
    for (const e of filtered) {
      const key = e.subject || "Altro";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
  }, [filtered]);

  // Recurring errors (same topic appears 3+ times)
  const recurring = useMemo(() => {
    const topicCount: Record<string, number> = {};
    for (const e of errors.filter(e => !e.resolved)) {
      if (e.topic) {
        topicCount[e.topic] = (topicCount[e.topic] || 0) + 1;
      }
    }
    return Object.entries(topicCount).filter(([, c]) => c >= 3).sort(([, a], [, b]) => b - a);
  }, [errors]);

  async function markResolved(id: string) {
    await supabase.from("learning_errors").update({ resolved: true } as any).eq("id", id);
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Nessun errore registrato</p>
        <p className="text-muted-foreground text-sm mt-1">Gli errori vengono tracciati automaticamente durante le sessioni guidate</p>
      </div>
    );
  }

  const openCount = errors.filter(e => !e.resolved).length;
  const resolvedCount = errors.filter(e => e.resolved).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{errors.length}</p>
          <p className="text-[10px] text-muted-foreground">Totali</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{openCount}</p>
          <p className="text-[10px] text-muted-foreground">Aperti</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{resolvedCount}</p>
          <p className="text-[10px] text-muted-foreground">Risolti</p>
        </div>
      </div>

      {/* Recurring alert */}
      {recurring.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">Errori ricorrenti</span>
          </div>
          <div className="space-y-1">
            {recurring.slice(0, 3).map(([topic, count]) => (
              <div key={topic} className="flex items-center justify-between">
                <span className="text-sm text-amber-700 dark:text-amber-300">{topic}</span>
                <span className="text-xs font-bold text-amber-600">{count}x</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(`/challenge/new?msg=${encodeURIComponent("Aiutami a capire: " + recurring[0][0])}`)}
            className="mt-3 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
          >
            Lavora sull'errore più frequente
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
        {([["open", "Aperti"], ["resolved", "Risolti"], ["all", "Tutti"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped errors */}
      {grouped.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">Nessun errore in questa categoria</p>
      ) : (
        grouped.map(([subject, subjectErrors]) => {
          const colors = subjectColors[subject] || subjectColors.Matematica;
          return (
            <div key={subject} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <BookOpen className={`w-3.5 h-3.5 ${colors.text}`} />
                </div>
                <h3 className={`font-semibold text-sm ${colors.text}`}>{subject}</h3>
                <span className="text-xs text-muted-foreground">({subjectErrors.length})</span>
              </div>
              {subjectErrors.map((err, i) => {
                const typeInfo = errorTypeLabels[err.error_type || ""] || { label: err.error_type || "Generico", color: "bg-muted text-muted-foreground" };
                return (
                  <motion.div
                    key={err.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-card border border-border rounded-xl p-3 ${err.resolved ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
                          {err.resolved && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <p className="text-sm font-medium text-foreground">{err.topic || "Errore generico"}</p>
                        {err.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{err.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(err.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      {!err.resolved && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markResolved(err.id); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                          title="Segna come risolto"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
