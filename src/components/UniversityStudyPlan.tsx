import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/contexts/LangContext";

export interface StudyPlanExam {
  id: string;
  nome: string;
  anno: number;
  cfu?: number;
  professore?: string;
  stato: "da_sostenere" | "in_preparazione" | "superato";
}

interface Props {
  exams: StudyPlanExam[];
  onChange: (exams: StudyPlanExam[]) => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  da_sostenere: { emoji: "🔴", labelKey: "plan_status_todo", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  in_preparazione: { emoji: "🟡", labelKey: "plan_status_preparing", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  superato: { emoji: "🟢", labelKey: "plan_status_passed", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
};

export default function UniversityStudyPlan({ exams, onChange, compact }: Props) {
  const { t } = useLang();
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([1, 2, 3]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<StudyPlanExam>>({});

  // Group by year
  const years = Array.from(new Set(exams.map(e => e.anno))).sort();
  if (years.length === 0) years.push(1);
  const maxYear = Math.max(...years, 1);

  function toggleYear(y: number) {
    setExpandedYears(prev => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  }

  function addExam(anno: number) {
    const newExam: StudyPlanExam = {
      id: crypto.randomUUID(),
      nome: "",
      anno,
      stato: "da_sostenere",
    };
    setDraft({ ...newExam });
    setEditingId(newExam.id);
    onChange([...exams, newExam]);
    setExpandedYears(prev => new Set(prev).add(anno));
  }

  function saveEdit() {
    if (!editingId || !draft.nome?.trim()) return;
    onChange(exams.map(e => e.id === editingId ? { ...e, ...draft } as StudyPlanExam : e));
    setEditingId(null);
    setDraft({});
  }

  function cancelEdit() {
    // If the exam has no name (just created), remove it
    if (editingId) {
      const exam = exams.find(e => e.id === editingId);
      if (exam && !exam.nome) {
        onChange(exams.filter(e => e.id !== editingId));
      }
    }
    setEditingId(null);
    setDraft({});
  }

  function deleteExam(id: string) {
    onChange(exams.filter(e => e.id !== id));
    if (editingId === id) { setEditingId(null); setDraft({}); }
  }

  function cycleStatus(id: string) {
    const order: StudyPlanExam["stato"][] = ["da_sostenere", "in_preparazione", "superato"];
    onChange(exams.map(e => {
      if (e.id !== id) return e;
      const idx = order.indexOf(e.stato);
      return { ...e, stato: order[(idx + 1) % order.length] };
    }));
  }

  function startEdit(exam: StudyPlanExam) {
    setEditingId(exam.id);
    setDraft({ ...exam });
  }

  const allYears = Array.from({ length: Math.max(maxYear, 3) }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {allYears.map(year => {
        const yearExams = exams.filter(e => e.anno === year);
        const isExpanded = expandedYears.has(year);

        return (
          <div key={year} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleYear(year)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">{t("plan_year")} {year}</span>
                <span className="text-xs text-muted-foreground">({yearExams.length} {yearExams.length === 1 ? t("plan_exam_singular") : t("plan_exam_plural")})</span>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-2 space-y-2">
                    {yearExams.map(exam => (
                      <div key={exam.id} className="flex items-center gap-2 py-1.5">
                        {editingId === exam.id ? (
                          /* Edit mode */
                          <div className="flex-1 space-y-2">
                            <Input
                              value={draft.nome || ""}
                              onChange={e => setDraft(d => ({ ...d, nome: e.target.value }))}
                              placeholder={t("plan_exam_name_placeholder")}
                              className="text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Input
                                type="number" min={1} max={99}
                                value={draft.cfu || ""}
                                onChange={e => setDraft(d => ({ ...d, cfu: parseInt(e.target.value) || undefined }))}
                                placeholder="CFU"
                                className="text-sm w-20"
                              />
                              <Input
                                value={draft.professore || ""}
                                onChange={e => setDraft(d => ({ ...d, professore: e.target.value }))}
                                placeholder={t("plan_professor_placeholder")}
                                className="text-sm flex-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit} disabled={!draft.nome?.trim()}>
                                <Check className="w-3 h-3 mr-1" />{t("plan_save")}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                <X className="w-3 h-3 mr-1" />{t("plan_cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            <button onClick={() => cycleStatus(exam.id)} title={t("plan_change_status")}>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[exam.stato].color}`}>
                                {STATUS_CONFIG[exam.stato].emoji} {t(STATUS_CONFIG[exam.stato].labelKey)}
                              </span>
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{exam.nome}</p>
                              {(exam.cfu || exam.professore) && (
                                <p className="text-[11px] text-muted-foreground">
                                  {exam.cfu ? `${exam.cfu} CFU` : ""}{exam.cfu && exam.professore ? " · " : ""}{exam.professore || ""}
                                </p>
                              )}
                            </div>
                            {!compact && (
                              <>
                                <button onClick={() => startEdit(exam)} className="p-1 text-muted-foreground hover:text-foreground">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteExam(exam.id)} className="p-1 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                    {!compact && (
                      <button
                        onClick={() => addExam(year)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />{t("plan_add_exam")}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {!compact && (
        <button
          onClick={() => addExam(maxYear + 1)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded-xl transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />{t("plan_add_year")}
        </button>
      )}
    </div>
  );
}
