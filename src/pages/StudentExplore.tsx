import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
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

  // Verifiche rows
  const verificheRows = useMemo(() => {
    const rows: Array<{ key: string; title: string; subject: string; date: string | null; grade: string; }> = [];
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
        });
      });
    return rows.slice(0, 5);
  }, [activities, manualGrades, classScale]);

  // Studio narrative
  const studyNarrative = useMemo(() => {
    const ritmo =
      activeDays >= 8 ? "ritmo costante e regolare"
      : activeDays >= 4 ? "ritmo discontinuo"
      : "ritmo molto irregolare";
    const continuita =
      inactiveDays === null ? "pochi dati di continuità"
      : inactiveDays <= 2 ? "buona continuità"
      : inactiveDays <= 5 ? "lievi interruzioni"
      : "lunghe pause tra le sessioni";
    const recentScores = activities.filter(a => a.score != null).slice(0, 5);
    const avg = recentScores.length > 0
      ? recentScores.reduce((s, a) => s + (a.score || 0), 0) / recentScores.length
      : null;
    const autonomia =
      avg === null ? "autonomia da osservare"
      : avg >= 65 ? "lavora in autonomia"
      : avg >= 45 ? "chiede supporto a tratti"
      : "ha bisogno di guida frequente";
    return `${studentName.split(" ")[0]} mostra ${ritmo} e ${continuita}. Sul fronte del lavoro personale, ${autonomia}.`;
  }, [activities, activeDays, inactiveDays, studentName]);

  // Verifiche narrative
  const verificheNarrative = useMemo(() => {
    if (verificheRows.length === 0) return "Non ci sono ancora verifiche registrate per questo studente. Appena arriveranno i primi voti, qui troverai un quadro chiaro dell'andamento.";
    const recent = activities.filter(a => a.score != null).slice(0, 4);
    if (recent.length === 0) return "Le verifiche sono state assegnate ma non ci sono ancora voti consolidati. Vale la pena seguire i prossimi risultati per capire il trend.";
    const avg = recent.reduce((s, a) => s + (a.score || 0), 0) / recent.length;
    if (avg < 50) return "Le ultime verifiche raccontano un periodo difficile: i risultati sono sotto la media e il pattern si ripete. Conviene capire dove si bloccano i ragionamenti prima di proporre nuovo carico.";
    if (avg < 65) return "Le verifiche recenti mostrano un andamento altalenante: alcuni momenti buoni e altri fragili. Un lavoro mirato sui punti deboli può stabilizzare i risultati.";
    return "Le verifiche recenti raccontano un buon momento: i risultati sono solidi e costanti. È un terreno favorevole per proporre qualche sfida in più.";
  }, [verificheRows, activities]);

  // Emotività narrative
  const emotivitaNarrative = useMemo(() => {
    const first = studentName.split(" ")[0];
    if (currentEmotion === "In difficoltà") return `Negli ultimi giorni ${first} mostra segnali di fatica: i risultati sono in calo e la presenza nelle attività si è diradata. Un dialogo breve può aiutare a capire cosa sta pesando.`;
    if (currentEmotion === "Stanco") return `${first} sembra sotto sforzo: i ritmi tengono ma i risultati recenti chiedono attenzione. Vale la pena monitorare la prossima settimana.`;
    if (currentEmotion === "Carico") return `${first} sta vivendo un buon momento: partecipa con energia e i risultati lo confermano. È un buon momento per proporre un approfondimento.`;
    return `${first} sta affrontando il lavoro con tono regolare, senza segnali di stress evidenti. Continuare con la routine attuale.`;
  }, [currentEmotion, studentName]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[380px] rounded-[28px]" />
          <Skeleton className="h-[380px] rounded-[28px]" />
          <Skeleton className="h-[320px] rounded-[28px]" />
          <Skeleton className="h-[320px] rounded-[28px]" />
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/30 pb-16">
      <BackLink label="allo studente" to={`/studente/${studentId}?classId=${classId}`} />

      <main className="mx-auto max-w-7xl px-6 pt-6 sm:pt-8">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <AvatarInitials name={studentName} size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-1">
              Quadro completo
            </p>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-tight">
              {studentName}
            </h1>
            <p className="mt-1 text-[14px] font-normal text-muted-foreground">Generato dal Coach · {today}</p>
          </div>
        </header>

        {/* 4 cards uniformi 2x2 */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* CARD 1 — Verifiche */}
          <article className="flex min-h-[380px] flex-col rounded-[28px] border border-border bg-card/95 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📊</div>
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight">Come sta andando l'apprendimento</h2>
            </div>
            <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
              {verificheNarrative}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <button
                onClick={() => navigate(`/studente/${studentId}?classId=${classId}&action=recovery`)}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Genera esercizi di rinforzo
              </button>
              <button
                onClick={() => navigate(`/classe/${classId}/grading`)}
                className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Vedi risultati attività
              </button>
            </div>
          </article>

          {/* CARD 2 — Metodo */}
          <article className="flex min-h-[380px] flex-col rounded-[28px] border border-border bg-card/95 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔁</div>
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight">Il metodo sta funzionando?</h2>
            </div>
            <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
              {studyNarrative} Se i risultati continuano a non corrispondere all'impegno, il canale potrebbe non essere quello giusto: vale la pena provare una spiegazione diversa.
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <button
                onClick={() => navigate(`/studente/${studentId}?classId=${classId}&action=alternative`)}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Prepara spiegazione alternativa
              </button>
              <button
                onClick={() => navigate(`/studente/${studentId}?classId=${classId}&action=simplified`)}
                className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Genera materiale diverso
              </button>
            </div>
          </article>

          {/* CARD 3 — Clima emotivo */}
          <article className="flex min-h-[320px] flex-col rounded-[28px] border border-border bg-card/95 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="text-2xl">💬</div>
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight">Clima emotivo</h2>
            </div>
            <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
              {emotivitaNarrative}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              {showAlert ? (
                <button
                  onClick={() => navigate(`/studente/${studentId}?classId=${classId}&openComm=1`)}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  Scrivi ai genitori
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/classe/${classId}`)}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  Avvia check-in
                </button>
              )}
              <button className="text-sm font-semibold text-muted-foreground transition hover:text-foreground">
                Vedi andamento emotivo
              </button>
            </div>
          </article>

          {/* CARD 4 — Attenzione */}
          <article className="flex min-h-[320px] flex-col rounded-[28px] border border-border bg-card/95 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="text-2xl">👤</div>
              <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight">Su cosa intervenire</h2>
            </div>
            <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
              {negativeWeeks >= 2
                ? `${studentName.split(" ")[0]} sta restando indietro nelle ultime settimane. Conviene intervenire adesso, prima che il distacco si allarghi e diventi più difficile recuperarlo.`
                : `Il quadro generale di ${studentName.split(" ")[0]} è sotto controllo. Continuare a osservare le prossime attività per cogliere in tempo eventuali segnali di rallentamento.`}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <button
                onClick={() => navigate(`/studente/${studentId}?classId=${classId}`)}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Apri profilo
              </button>
              <button
                onClick={() => navigate(`/studente/${studentId}?classId=${classId}&action=recovery`)}
                className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Genera recupero
              </button>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
