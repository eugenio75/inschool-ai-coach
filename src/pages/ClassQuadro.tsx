import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, Repeat, MessageCircle, User, Check, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/BackLink";
import { analyzeFullPicture, type FullPictureInsight } from "@/lib/classFullPictureAnalysis";

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

function getLastActivityMap(assignmentResults: any[], manualGrades: any[], students: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  const nameToSid: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    const fn = (s.profile?.name || s.student_name || "").trim().toLowerCase();
    if (fn && sid) nameToSid[fn] = sid;
  });
  const apply = (sid: string | undefined | null, date: string | undefined | null) => {
    if (!sid || !date) return;
    if (!map[sid] || new Date(date) > new Date(map[sid])) map[sid] = date;
  };
  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const date = r.completed_at || r.created_at || a.assigned_at;
      apply(r.student_id || r.id, date);
      const nm = (r.student_name || "").trim().toLowerCase();
      if (nm && nameToSid[nm]) apply(nameToSid[nm], date);
    });
  });
  manualGrades.forEach((g: any) => {
    apply(g.student_id, g.graded_at);
    const nm = (g.student_name || "").trim().toLowerCase();
    if (nm && nameToSid[nm]) apply(nameToSid[nm], g.graded_at);
  });
  return map;
}

interface SectionCardProps {
  icon?: React.ReactNode;
  emoji: string;
  title: string;
  minHeight?: string;
  children: React.ReactNode;
}

function SectionCard({ emoji, title, minHeight = "380px", children }: SectionCardProps) {
  return (
    <article
      className="flex flex-col rounded-[28px] border border-border bg-card/95 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
      style={{ minHeight }}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl" aria-hidden>{emoji}</div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </article>
  );
}

export default function ClassQuadro() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [insight, setInsight] = useState<FullPictureInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState("Coach");

  useEffect(() => {
    if (!classId) return;
    if (!profileId && !user) return;
    (async () => {
      try {
        const { getCoachName } = await import("@/lib/coachPreferences");
        const id = profileId || user?.id;
        if (id) {
          const name = await getCoachName(id, !!profileId);
          if (name) setCoachName(name);
        }
      } catch {}
    })();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, profileId, user?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let loadedClasse: any = null;
      let loadedStudents: any[] = [];
      let loadedResults: any[] = [];
      let emotionalCheckins: any[] = [];
      let emotionalAlerts: any[] = [];
      let focusSessions: any[] = [];
      let manualGrades: any[] = [];

      if (authSession?.access_token) {
        const data = await fetchTeacherClassData(classId!);
        loadedClasse = data.classe;
        loadedStudents = data.students || [];
        loadedResults = data.assignmentResults || [];
        emotionalCheckins = data.emotionalCheckins || [];
        emotionalAlerts = data.emotionalAlerts || [];
        focusSessions = data.focusSessions || [];

        const { data: grades } = await (supabase as any)
          .from("manual_grades")
          .select("*")
          .eq("class_id", classId);
        manualGrades = grades || [];
      } else {
        const { data: cl } = await (supabase as any).from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
      }

      // Demo enrichment (mirrors ClassView behavior so the page is never empty in demo)
      const demoNameRe = /^\s*studente\s*$|esempio|demo|sample/i;
      const subj = loadedClasse?.materia || "";
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      const syntheticResults: any[] = [];
      loadedStudents.forEach((s: any) => {
        const sid = s.student_id || s.id;
        const fn = s.profile?.name || s.student_name || "";
        if (!demoNameRe.test(fn)) return;
        const hasReal = loadedResults.some((a: any) =>
          (a.results || []).some((r: any) => (r.student_id || r.id) === sid && r.score != null),
        );
        if (hasReal) return;
        syntheticResults.push({
          id: `demo-followup-${sid}`,
          title: `Verifica di ${subj || "matematica"}`,
          subject: subj || "Matematica",
          assigned_at: fiveDaysAgo,
          results: [{
            student_id: sid,
            student_name: fn,
            score: 8,
            status: "completed",
            errors_summary: { "I numeri decimali": 3 },
          }],
        });
      });

      const allResults = [...loadedResults, ...syntheticResults];
      const lastActivityMap = getLastActivityMap(allResults, manualGrades, loadedStudents);

      const result = analyzeFullPicture({
        students: loadedStudents,
        assignmentResults: allResults,
        manualGrades,
        classSubject: loadedClasse?.materia || "",
        lastActivityMap,
        emotionalCheckins,
        emotionalAlerts,
        focusSessions,
      });

      setClasse(loadedClasse);
      setInsight(result);
    } catch (err) {
      console.error("ClassQuadro load error:", err);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#F2F2F7" }}>
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!classe || !insight) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2F2F7" }}>
        <div className="text-center">
          <p className="text-muted-foreground">Classe non trovata.</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Indietro</Button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" });

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: "#F2F2F7" }}>
      <BackLink label="alla classe" to={`/classe/${classId}`} />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-7 sm:py-10">
        <header className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground leading-tight">
            Quadro completo · {classe.nome}
          </h1>
          <p className="mt-1.5 text-[14px] font-normal text-muted-foreground">
            Generato da {coachName} · {today}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch [&>section]:h-full">
          {/* 1. Apprendimento */}
          <SectionCard emoji="📊" icon={<BookOpen className="h-4 w-4" />} title="Come sta andando l'apprendimento">
            <p className="text-[16px] font-normal leading-[1.7] text-foreground/85">
              {insight.learning.paragraph}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/classe/${classId}/materiali?create=true&tipo=esercizio`)}
                className="rounded-full h-9 text-[15px] font-medium"
              >
                Genera esercizi di rinforzo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/classe/${classId}`)}
                className="rounded-full h-9 text-[15px] font-medium"
              >
                Apri risultati attività
              </Button>
            </div>
          </SectionCard>

          {/* 2. Metodo */}
          <SectionCard emoji="🔁" icon={<Repeat className="h-4 w-4" />} title="Il metodo sta funzionando?">
            <p className="text-[16px] font-normal leading-[1.7] text-foreground/85">
              {insight.method.paragraph}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/materiali-docente?classId=${classId}&tipo=lezione`)}
                className="rounded-full h-9 text-[15px] font-medium"
              >
                Prepara spiegazione alternativa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/materiali-docente?classId=${classId}&tipo=lezione&approccio=alternativo`)}
                className="rounded-full h-9 text-[15px] font-medium"
              >
                Genera materiale con approccio diverso
              </Button>
            </div>
          </SectionCard>

          {/* 3. Clima */}
          <SectionCard emoji="💬" icon={<MessageCircle className="h-4 w-4" />} title="Clima della classe">
            <p className="text-[16px] font-normal leading-[1.7] text-foreground/85">
              {insight.climate.paragraph}
            </p>
            {insight.climate.hasSignals && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/classe/${classId}?action=parent-email`)}
                  className="rounded-full h-9 text-[15px] font-medium"
                >
                  Scrivi ai genitori
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/agenda-docente?action=create&type=ascolto`)}
                  className="rounded-full h-9 text-[15px] font-medium"
                >
                  Programma momento di ascolto
                </Button>
              </div>
            )}
          </SectionCard>

          {/* 4. Studenti da seguire */}
          <SectionCard emoji="👤" icon={<User className="h-4 w-4" />} title="Chi ha bisogno di attenzione">
            {insight.followStudents.length === 0 ? (
              <div className="flex items-center gap-2.5 text-[16px] font-normal text-foreground/80">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-4 w-4" />
                </span>
                <span>Tutti gli studenti stanno procedendo regolarmente.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {insight.followStudents.map((s) => (
                  <div
                    key={s.studentId}
                    className="rounded-xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold text-foreground">{s.studentName}</p>
                      <p className="text-[14px] font-normal text-muted-foreground leading-snug mt-0.5">
                        {s.reason}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {s.primaryActionLabel && (
                        <Button
                          size="sm"
                          onClick={() =>
                            s.primaryActionLabel === "Recupero"
                              ? navigate(`/materiali-docente?classId=${classId}&tipo=recupero&studentId=${s.studentId}`)
                              : navigate(`/studente/${s.studentId}?classId=${classId}`)
                          }
                          className="rounded-full h-8 text-[15px] font-medium px-4"
                        >
                          {s.primaryActionLabel}
                        </Button>
                      )}
                      {s.secondaryActionLabel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            s.secondaryActionLabel === "Recupero"
                              ? navigate(`/materiali-docente?classId=${classId}&tipo=recupero&studentId=${s.studentId}`)
                              : navigate(`/studente/${s.studentId}?classId=${classId}`)
                          }
                          className="rounded-full h-8 text-[15px] font-medium px-4 inline-flex items-center gap-1"
                        >
                          {s.secondaryActionLabel}
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
