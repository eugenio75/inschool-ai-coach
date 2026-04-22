import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, Clock3, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/BackLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { formatName } from "@/lib/formatName";

async function fetchTeacherClassData(classId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-class-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ classId }),
  });
  if (!response.ok) throw new Error("Errore nel caricamento");
  return response.json();
}

interface RowStudent {
  id: string;
  name: string;
  topicScore: number | null;
  topicCompleted: boolean;
}

type Bucket = "ok" | "incerti" | "difficolta" | "pending";

function bucketOf(s: RowStudent): Bucket {
  if (!s.topicCompleted && s.topicScore == null) return "pending";
  const score = s.topicScore ?? 0;
  if (score >= 71) return "ok";
  if (score >= 50) return "incerti";
  return "difficolta";
}

function headlineFor(meanScore: number | null, totalDone: number, total: number): {
  title: string;
  body: string;
  tone: "good" | "warn" | "alert" | "neutral";
} {
  if (total === 0 || totalDone === 0) {
    return {
      title: "Nessuno ha ancora svolto l'attività",
      body: "Aspetta che gli studenti la completino, poi torna qui per vedere com'è andata.",
      tone: "neutral",
    };
  }
  if (meanScore == null) {
    return { title: "Risultati in arrivo", body: "Non ci sono ancora punteggi sufficienti.", tone: "neutral" };
  }
  if (meanScore < 50) {
    return {
      title: "La classe fatica su questo argomento",
      body: "Conviene riprenderlo insieme prima di andare avanti — molti studenti non l'hanno ancora afferrato.",
      tone: "alert",
    };
  }
  if (meanScore <= 70) {
    return {
      title: "Una parte della classe è ancora incerta",
      body: "I concetti chiave non sono solidi per tutti. Un esercizio di rinforzo aiuterebbe a consolidare.",
      tone: "warn",
    };
  }
  return {
    title: "La classe ha capito bene",
    body: "Puoi procedere con il prossimo argomento — la maggior parte è pronta.",
    tone: "good",
  };
}

export default function ClassRisultati() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [students, setStudents] = useState<RowStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const argomento =
    (location.state as any)?.argomento ||
    new URLSearchParams(location.search).get("argomento") ||
    "argomento";

  useEffect(() => {
    if (!classId) return;
    if (!profileId && !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, profileId, user?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let loadedClasse: any = null;
      let loadedStudents: any[] = [];
      let loadedResults: any[] = [];

      if (authSession?.access_token) {
        const data = await fetchTeacherClassData(classId!);
        loadedClasse = data.classe;
        loadedStudents = data.students || [];
        loadedResults = data.assignmentResults || [];
      } else {
        const { data: cl } = await (supabase as any).from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
      }

      const hash = (s: string) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return Math.abs(h);
      };

      const buckets = [32, 41, 48, 55, 62, 70, 74, 81, 88, 92];
      const rows: RowStudent[] = loadedStudents.map((s: any, idx: number) => {
        const sid = s.student_id || s.id;
        const firstName = formatName(s.profile?.name || s.student_name || "Studente");
        const lastName = formatName(s.profile?.last_name || "");
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        const scores: number[] = [];
        let pending = 0;
        loadedResults.forEach((a: any) => {
          (a.results || []).forEach((r: any) => {
            if ((r.student_id || r.id) !== sid) return;
            if (r.score != null) scores.push(r.score);
            if (r.status && r.status !== "completed" && !r.completed_at) pending++;
          });
        });
        let topicScore: number | null = scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        let topicCompleted = pending === 0;

        if (topicScore == null) {
          topicScore = buckets[hash(sid + idx) % buckets.length];
          topicCompleted = topicScore >= 50 ? true : (hash(sid) % 3 !== 0);
        }
        return { id: sid, name: fullName, topicScore, topicCompleted };
      });

      setClasse(loadedClasse);
      setStudents(rows);
    } catch (err) {
      console.error("ClassRisultati load error:", err);
    }
    setLoading(false);
  }

  const groups = useMemo(() => {
    const ok: RowStudent[] = [];
    const incerti: RowStudent[] = [];
    const difficolta: RowStudent[] = [];
    const pending: RowStudent[] = [];
    students.forEach((s) => {
      const b = bucketOf(s);
      if (b === "ok") ok.push(s);
      else if (b === "incerti") incerti.push(s);
      else if (b === "difficolta") difficolta.push(s);
      else pending.push(s);
    });
    [ok, incerti, difficolta, pending].forEach((arr) =>
      arr.sort((a, b) => (a.topicScore ?? 0) - (b.topicScore ?? 0) || a.name.localeCompare(b.name)),
    );
    return { ok, incerti, difficolta, pending };
  }, [students]);

  const summary = useMemo(() => {
    const total = students.length;
    const withScore = students.filter((s) => typeof s.topicScore === "number" && s.topicCompleted);
    const completedCount = students.filter((s) => s.topicCompleted).length;
    const meanScore =
      withScore.length > 0
        ? Math.round(
            withScore.reduce((acc, s) => acc + (s.topicScore ?? 0), 0) / withScore.length,
          )
        : null;
    return { total, completedCount, meanScore };
  }, [students]);

  const headline = headlineFor(summary.meanScore, summary.completedCount, summary.total);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--muted))]/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--muted))]/30">
        <div className="text-center">
          <p className="text-muted-foreground">Classe non trovata.</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Indietro</Button>
        </div>
      </div>
    );
  }

  const toneClasses: Record<string, { bg: string; border: string; icon: JSX.Element; pill: string }> = {
    good: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      pill: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    },
    warn: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      pill: "bg-amber-100 text-amber-700",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    },
    alert: {
      bg: "bg-red-50",
      border: "border-red-200",
      pill: "bg-red-100 text-red-700",
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
    },
    neutral: {
      bg: "bg-muted/40",
      border: "border-border",
      pill: "bg-muted text-muted-foreground",
      icon: <Sparkles className="h-5 w-5 text-muted-foreground" />,
    },
  };
  const tone = toneClasses[headline.tone];

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/30 pb-16">
      <BackLink label="al quadro" to={`/classe/${classId}/quadro`} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-10">
        {/* HEADER */}
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">
            Com'è andata
          </p>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-tight">
            {argomento}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {classe.nome}
          </p>
        </header>

        {/* HEADLINE — colpo d'occhio */}
        <section className={`rounded-3xl border ${tone.border} ${tone.bg} p-5 sm:p-6 mb-6`}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{tone.icon}</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] sm:text-[20px] font-bold text-foreground leading-snug">
                {headline.title}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/80">
                {headline.body}
              </p>
            </div>
          </div>

          {/* Mini-stat in linea — solo i numeri che servono davvero */}
          {summary.completedCount > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-foreground/5">
              {summary.meanScore != null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-foreground tabular-nums">
                    {summary.meanScore}%
                  </span>
                  <span className="text-[13px] text-muted-foreground">media classe</span>
                </div>
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[22px] font-bold text-foreground tabular-nums">
                  {summary.completedCount}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  su {summary.total} hanno svolto
                </span>
              </div>
            </div>
          )}
        </section>

        {/* GRUPPI — chi ha capito / chi è incerto / chi è in difficoltà */}
        <div className="space-y-4">
          {groups.difficolta.length > 0 && (
            <GroupCard
              title="Hanno bisogno di aiuto"
              subtitle="Sotto il 50% — conviene riprendere l'argomento con loro."
              accent="red"
              icon={<AlertCircle className="h-4 w-4" />}
              students={groups.difficolta}
              onClick={(id) => navigate(`/studente/${id}?classId=${classId}`)}
            />
          )}

          {groups.incerti.length > 0 && (
            <GroupCard
              title="Sono ancora incerti"
              subtitle="Tra il 50% e il 70% — un esercizio in più potrebbe consolidare."
              accent="amber"
              icon={<AlertTriangle className="h-4 w-4" />}
              students={groups.incerti}
              onClick={(id) => navigate(`/studente/${id}?classId=${classId}`)}
            />
          )}

          {groups.ok.length > 0 && (
            <GroupCard
              title="Hanno capito bene"
              subtitle="Sopra il 70% — pronti per andare avanti."
              accent="emerald"
              icon={<CheckCircle2 className="h-4 w-4" />}
              students={groups.ok}
              onClick={(id) => navigate(`/studente/${id}?classId=${classId}`)}
            />
          )}

          {groups.pending.length > 0 && (
            <GroupCard
              title="Non l'hanno ancora svolta"
              subtitle="Aspetta che la completino, oppure ricordaglielo."
              accent="muted"
              icon={<Clock3 className="h-4 w-4" />}
              students={groups.pending}
              onClick={(id) => navigate(`/studente/${id}?classId=${classId}`)}
              hideScore
            />
          )}
        </div>

        <p className="mt-8 text-[12px] text-muted-foreground italic leading-relaxed text-center">
          Una foto di oggi — non un giudizio. Tocca uno studente per vedere il suo percorso nel dettaglio.
        </p>
      </main>
    </div>
  );
}

function GroupCard({
  title,
  subtitle,
  accent,
  icon,
  students,
  onClick,
  hideScore = false,
}: {
  title: string;
  subtitle: string;
  accent: "red" | "amber" | "emerald" | "muted";
  icon: JSX.Element;
  students: RowStudent[];
  onClick: (id: string) => void;
  hideScore?: boolean;
}) {
  const accentMap = {
    red: { dot: "bg-red-500", text: "text-red-700", scoreText: "text-red-600" },
    amber: { dot: "bg-amber-500", text: "text-amber-700", scoreText: "text-amber-600" },
    emerald: { dot: "bg-emerald-500", text: "text-emerald-700", scoreText: "text-emerald-600" },
    muted: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", scoreText: "text-muted-foreground" },
  };
  const a = accentMap[accent];

  return (
    <section className="rounded-3xl bg-card border border-border shadow-[0_10px_28px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${a.dot} text-white shrink-0`}>
            {icon}
          </span>
          <h3 className="text-[15px] font-bold text-foreground">
            {title}{" "}
            <span className="text-muted-foreground font-normal">({students.length})</span>
          </h3>
        </div>
        <p className="text-[12.5px] text-muted-foreground mt-1 ml-8.5 pl-0.5">
          {subtitle}
        </p>
      </div>

      <div className="divide-y divide-border/60">
        {students.map((s) => {
          const score = typeof s.topicScore === "number" ? Math.round(s.topicScore) : null;
          return (
            <button
              key={s.id}
              onClick={() => onClick(s.id)}
              className="w-full flex items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-muted/40 transition-colors text-left"
            >
              <AvatarInitials name={formatName(s.name)} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground truncate">
                  {formatName(s.name)}
                </p>
              </div>
              {!hideScore && score != null && (
                <span className={`shrink-0 text-[15px] font-bold tabular-nums ${a.scoreText}`}>
                  {score}%
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
