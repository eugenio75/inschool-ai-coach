import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function TeacherAssignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAssignments();
  }, [user]);

  async function loadAssignments() {
    try {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("*")
        .eq("student_id", user!.id)
        .order("assigned_at", { ascending: false });

      setAssignments(data || []);
    } catch (err) {
      console.error("TeacherAssignments error:", err);
    }
    setLoading(false);
  }

  if (loading) return null;

  if (assignments.length === 0) return null;

  const typeColors: Record<string, string> = {
    compito: "bg-blue-100 text-blue-700",
    verifica: "bg-red-100 text-red-700",
    esercizi: "bg-purple-100 text-purple-700",
    recupero: "bg-orange-100 text-orange-700",
    potenziamento: "bg-green-100 text-green-700",
    traccia: "bg-amber-100 text-amber-700",
  };

  const newCount = assignments.filter(a => a.metadata?.status !== "opened").length;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs uppercase font-semibold tracking-widest text-[var(--color-text-muted)]">
          Dal tuo professore
        </h3>
        {newCount > 0 && (
          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {newCount}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {assignments.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/session/${a.id}`)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] border-l-4 border-l-orange-400 rounded-xl p-4 cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${typeColors[a.type] || "bg-slate-100 text-slate-600"}`}>
                    {a.type}
                  </span>
                  {a.subject && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">{a.subject}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{a.title}</p>
                {a.due_date && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Scadenza: {new Date(a.due_date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )}
              </div>
              <FileText className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
