import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { percentToGrade, type ScaleId } from "@/components/teacher/GradeReviewModal";

type Activity = {
  id?: string;
  title: string;
  type: string;
  subject: string;
  due_date?: string | null;
  completed_at?: string | null;
  score?: number | null;
  status?: string | null;
  assignment_id?: string;
};

type ManualGrade = {
  id: string;
  assignment_id?: string | null;
  assignment_title?: string | null;
  grade: string;
  grade_scale: string;
  graded_at: string;
};

const EMOTION_CHIPS = ["Sereno", "Stanco", "In difficoltà", "Carico"] as const;
type Emotion = typeof EMOTION_CHIPS[number];

function statusLabel(a: Activity): { label: string; tone: "ok" | "warn" | "wait" | "late" } {
  if (a.status === "completed") return { label: "Completato", tone: "ok" };
  if (a.status === "in_progress") return { label: "In corso", tone: "wait" };
  if (a.due_date && new Date(a.due_date) < new Date()) return { label: "In ritardo", tone: "late" };
  return { label: "Da fare", tone: "wait" };
}

function inferEmotion(activities: Activity[], inactiveDays: number | null): Emotion {
  if (inactiveDays !== null && inactiveDays >= 7) return "In difficoltà";
  const recent = activities.filter(a => a.score != null).slice(0, 4);
  if (recent.length === 0) return "Sereno";
  const avg = recent.reduce((s, a) => s + (a.score || 0), 0) / recent.length;
  if (avg < 35) return "In difficoltà";
  if (avg < 55) return "Stanco";
  if (avg >= 80) return "Carico";
  return "Sereno";
}

function buildWeeks(activities: Activity[]): Array<{ label: string; state: string }> {
  const weeks = [3, 2, 1, 0];
  const now = Date.now();
  return weeks.map((wAgo) => {
    const start = now - (wAgo + 1) * 7 * 86400000;
    const end = now - wAgo * 7 * 86400000;
    const inWeek = activities.filter(a => {
      if (!a.completed_at) return false;
      const t = new Date(a.completed_at).getTime();
      return t >= start && t < end && a.score != null;
    });
    let state = "Stabile";
    if (inWeek.length === 0) state = "Pochi dati";
    else {
      const avg = inWeek.reduce((s, a) => s + (a.score || 0), 0) / inWeek.length;
      if (avg < 35) state = "In difficoltà";
      else if (avg < 55) state = "Fatica";
      else state = "Stabile";
    }
    const idx = 4 - wAgo;
    return { label: `Settimana ${idx}`, state };
  });
}

export default function StudentExplore() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("Studente");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [manualGrades, setManualGrades] = useState<ManualGrade[]>([]);
  const [classScale, setClassScale] = useState<ScaleId>("/10");
  const [activeDays, setActiveDays] = useState(0);
  const [lastAccess, setLastAccess] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !classId || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, classId, user]);

  async function load() {
    setLoading(true);
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    try {
      const { data: classeData } = await (supabase as any)
        .from("classi").select("nome, materia").eq("id", classId).single();
      const subj: string = classeData?.materia || "";
      const subjectMatches = (s: string | null | undefined) =>
        !subj || (s || "").trim().toLowerCase() === subj.trim().toLowerCase();

      const { data: profile } = await (supabase as any)
        .from("child_profiles")
        .select("name, last_name")
        .eq("id", studentId)
        .single();
      const name = profile
        ? (profile.last_name ? `${profile.name} ${profile.last_name}` : profile.name)
        : "Studente";
      setStudentName(name);

      const { data: results } = await (supabase as any)
        .from("assignment_results")
        .select("*, teacher_assignments!assignment_results_assignment_id_fkey(title, type, subject, due_date, assigned_at)")
        .eq("student_id", studentId)
        .order("completed_at", { ascending: false });

      const list: Activity[] = [];
      (results || []).forEach((r: any) => {
        const a = r.teacher_assignments;
        const aSubj = a?.subject || "";
        if (!subjectMatches(aSubj)) return;
        list.push({
          id: r.id,
          title: a?.title || "Attività",
          type: a?.type || "",
          subject: aSubj,
          due_date: a?.due_date,
          completed_at: r.completed_at,
          score: r.score,
          status: r.status,
          assignment_id: r.assignment_id,
        });
      });
      setActivities(list);

      const { data: grades } = await (supabase as any)
        .from("manual_grades")
        .select("*")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .order("graded_at", { ascending: false });
      setManualGrades(grades || []);

      const { data: classGrades } = await (supabase as any)
        .from("manual_grades")
        .select("grade_scale")
        .eq("class_id", classId);
      if (classGrades && classGrades.length > 0) {
        const counts: Record<string, number> = {};
        classGrades.forEach((g: any) => {
          const s = g.grade_scale || "/10";
          counts[s] = (counts[s] || 0) + 1;
        });
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        if (top) setClassScale(top[0] as ScaleId);
      }

      const completed = list.filter(a => a.status === "completed" && a.completed_at)
        .map(a => new Date(a.completed_at!).toDateString());
      const unique = [...new Set(completed)];
      setActiveDays(unique.length);
      if (unique.length > 0) setLastAccess(unique[0]);
    } catch (e) {
      console.error("StudentExplore load error:", e);
    }
    setLoading(false);
  }

  const inactiveDays = useMemo(() => {
    if (!lastAccess) return null;
    return Math.floor((Date.now() - new Date(lastAccess).getTime()) / 86400000);
  }, [lastAccess]);

  const currentEmotion = useMemo(() => inferEmotion(activities, inactiveDays), [activities, inactiveDays]);
  const weeks = useMemo(() => buildWeeks(activities), [activities]);

  const negativeWeeks = weeks.filter(w => w.state === "Fatica" || w.state === "In difficoltà").length;
  const showAlert = negativeWeeks >= 2 || currentEmotion === "In difficoltà";

  // Build verifiche rows: combine activities + standalone manual grades
  const verificheRows = useMemo(() => {
    const rows: Array<{
      key: string;
      title: string;
      subject: string;
      date: string | null;
      grade: string;
      status: { label: string; tone: "ok" | "warn" | "wait" | "late" };
    }> = [];
    activities.forEach((a, i) => {
      const score = a.score != null ? Math.round(a.score) : null;
      const confirmed = manualGrades.find(g => a.assignment_id && g.assignment_id === a.assignment_id);
      let grade = "—";
      if (confirmed) {
        grade = `${confirmed.grade}${confirmed.grade_scale !== "giudizio" ? confirmed.grade_scale : ""}`;
      } else if (score != null) {
        grade = `${percentToGrade(score, classScale)}${classScale !== "giudizio" ? classScale : ""}`;
      }
      rows.push({
        key: `a-${i}`,
        title: a.title,
        subject: a.subject,
        date: a.completed_at,
        grade,
        status: statusLabel(a),
      });
    });
    manualGrades
      .filter(g => !g.assignment_id || !activities.some(a => a.assignment_id === g.assignment_id))
      .forEach(g => {
        rows.push({
          key: `m-${g.id}`,
          title: g.assignment_title || "Voto manuale",
          subject: "Voto docente",
          date: g.graded_at,
          grade: `${g.grade}${g.grade_scale !== "giudizio" ? g.grade_scale : ""}`,
          status: { label: "Registrato", tone: "ok" },
        });
      });
    return rows;
  }, [activities, manualGrades, classScale]);

  // Studio indicators (plain Italian descriptions, no percentages)
  const studyIndicators = useMemo(() => {
    const ritmo =
      activeDays >= 8 ? "Ritmo costante e regolare"
      : activeDays >= 4 ? "Ritmo discontinuo"
      : "Ritmo molto irregolare";
    const continuita =
      inactiveDays === null ? "Pochi dati per valutare"
      : inactiveDays <= 2 ? "Continuità buona"
      : inactiveDays <= 5 ? "Lievi interruzioni"
      : "Lunghe pause tra le sessioni";
    const recentScores = activities.filter(a => a.score != null).slice(0, 5);
    const avg = recentScores.length > 0
      ? recentScores.reduce((s, a) => s + (a.score || 0), 0) / recentScores.length
      : null;
    const autonomia =
      avg === null ? "Da osservare"
      : avg >= 65 ? "Lavora in autonomia"
      : avg >= 45 ? "Chiede supporto a tratti"
      : "Ha bisogno di guida frequente";
    const completed = activities.filter(a => a.status === "completed").length;
    const modalita =
      completed === 0 ? "Pochi dati di studio"
      : completed >= 6 ? "Studio approfondito"
      : "Studio essenziale";
    return { ritmo, continuita, autonomia, modalita };
  }, [activities, activeDays, inactiveDays]);

  if (loading) {
    return (
      <div className="max-w-[896px] mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-[26px]" />
        <Skeleton className="h-48 rounded-[26px]" />
        <Skeleton className="h-48 rounded-[26px]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background relative pb-24">
      <BackLink label="allo studente" to={`/studente/${studentId}?classId=${classId}`} />

      <div className="max-w-[896px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-[28px] sm:text-[32px] font-bold text-foreground tracking-tight">Esplora studente</h1>
          <p className="text-[15px] text-muted-foreground mt-1">Verifiche, emotività e abitudini di studio</p>
        </header>

        <div className="space-y-4 sm:space-y-5">
          {/* SECTION 1 — VERIFICHE */}
          <section className="bg-card border border-border rounded-[26px] shadow-sm p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Verifiche</span>
            </div>
            {verificheRows.length === 0 ? (
              <p className="text-[15px] text-muted-foreground py-2">Nessuna verifica registrata.</p>
            ) : (
              <ul className="divide-y divide-border">
                {verificheRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-foreground truncate">{row.title}</p>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        {row.subject}
                        {row.date ? ` · ${new Date(row.date).toLocaleDateString("it-IT")}` : ""}
                      </p>
                    </div>
                    <span className="text-[15px] font-semibold text-foreground tabular-nums shrink-0 w-14 text-right">
                      {row.grade}
                    </span>
                    <span className={[
                      "text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0",
                      row.status.tone === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      row.status.tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                      row.status.tone === "late" && "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                      row.status.tone === "wait" && "bg-muted text-muted-foreground",
                    ].filter(Boolean).join(" ")}>
                      {row.status.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SECTION 2 — EMOTIVITÀ */}
          <section className="bg-card border border-border rounded-[26px] shadow-sm p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Emotività</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {EMOTION_CHIPS.map((chip) => {
                const active = chip === currentEmotion;
                return (
                  <span
                    key={chip}
                    className={[
                      "px-3.5 py-1.5 rounded-full text-[13px] transition-colors",
                      active
                        ? "bg-foreground/10 text-foreground font-semibold"
                        : "bg-muted/40 text-muted-foreground font-normal",
                    ].join(" ")}
                  >
                    {chip}
                  </span>
                );
              })}
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-[15px] text-foreground leading-relaxed">
                {currentEmotion === "In difficoltà" && `Negli ultimi giorni ${studentName.split(" ")[0]} mostra segnali di fatica: i risultati sono in calo e la presenza nelle attività si è diradata.`}
                {currentEmotion === "Stanco" && `${studentName.split(" ")[0]} sembra sotto sforzo: i ritmi tengono ma i risultati recenti chiedono attenzione.`}
                {currentEmotion === "Sereno" && `${studentName.split(" ")[0]} sta affrontando il lavoro con tono regolare, senza segnali di stress evidenti.`}
                {currentEmotion === "Carico" && `${studentName.split(" ")[0]} sta vivendo un buon momento: partecipa con energia e i risultati lo confermano.`}
              </p>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {currentEmotion === "In difficoltà" && "Un dialogo breve in classe può aiutare a capire cosa sta pesando. Anche un compito alleggerito sarebbe un segnale di vicinanza."}
                {currentEmotion === "Stanco" && "Vale la pena monitorare la prossima settimana e, se serve, proporre un materiale di ripasso più leggero."}
                {currentEmotion === "Sereno" && "Continuare con la routine attuale: il livello di coinvolgimento è adeguato."}
                {currentEmotion === "Carico" && "È un buon momento per proporre una sfida in più o un approfondimento."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {weeks.map((w) => (
                <div key={w.label} className="bg-muted/30 border border-border/60 rounded-2xl px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{w.label}</p>
                  <p className="text-[14px] font-semibold text-foreground mt-1">{w.state}</p>
                </div>
              ))}
            </div>

            <p className="text-[14px] text-muted-foreground leading-relaxed">
              {negativeWeeks >= 2
                ? "L'andamento delle ultime settimane suggerisce un periodo di affaticamento prolungato."
                : negativeWeeks === 1
                ? "Una settimana di flessione, ma il quadro generale resta sotto controllo."
                : "Andamento emotivo stabile nelle ultime quattro settimane."}
            </p>

            {showAlert && (
              <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-foreground leading-relaxed">
                    Il quadro emotivo recente di {studentName.split(" ")[0]} merita un confronto con la famiglia.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-[13px] shrink-0 bg-card"
                  onClick={() => navigate(`/studente/${studentId}?classId=${classId}&openComm=1`)}
                >
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Scrivi ai genitori
                </Button>
              </div>
            )}
          </section>

          {/* SECTION 3 — STUDIO */}
          <section className="bg-card border border-border rounded-[26px] shadow-sm p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Studio</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {[
                { label: "Ritmo", value: studyIndicators.ritmo },
                { label: "Continuità", value: studyIndicators.continuita },
                { label: "Autonomia", value: studyIndicators.autonomia },
                { label: "Modalità", value: studyIndicators.modalita },
              ].map((it) => (
                <div key={it.label} className="bg-muted/30 border border-border/60 rounded-2xl px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{it.label}</p>
                  <p className="text-[14px] font-semibold text-foreground mt-1 leading-snug">{it.value}</p>
                </div>
              ))}
            </div>

            <p className="text-[15px] text-foreground leading-relaxed">
              {studyIndicators.ritmo.includes("costante")
                ? `${studentName.split(" ")[0]} mantiene un ritmo regolare e mostra autonomia nell'organizzare il lavoro.`
                : studyIndicators.ritmo.includes("discontinuo")
                ? `Lo studio di ${studentName.split(" ")[0]} procede a tratti: alterna momenti di impegno a pause più lunghe.`
                : `${studentName.split(" ")[0]} fatica a darsi una routine stabile, e questo si riflette sui risultati.`}
              {" "}
              {studyIndicators.autonomia.includes("autonomia")
                ? "L'approccio è autonomo, segno positivo da sostenere."
                : studyIndicators.autonomia.includes("supporto")
                ? "Beneficerebbe di una guida puntuale sui passaggi più critici."
                : "Sarebbe utile un accompagnamento più ravvicinato nelle prossime settimane."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
