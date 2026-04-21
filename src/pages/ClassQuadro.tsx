import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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

function SectionCard({ emoji, title, minHeight = "320px", children }: SectionCardProps) {
  return (
    <article
      className="flex flex-col rounded-[28px] border border-border bg-card/95 p-6 sm:p-7 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
      style={{ minHeight }}
    >
      <div className="flex items-center gap-3">
        <div className="text-xl" aria-hidden>{emoji}</div>
        <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight">{title}</h2>
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
    <div className="min-h-screen bg-[hsl(var(--muted))]/30 pb-16">
      <BackLink label="alla classe" to={`/classe/${classId}`} />
      <main className="mx-auto max-w-7xl px-6 pt-6 sm:pt-10">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">
            Quadro completo
          </p>
          <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none">
            {classe.nome}
          </h1>
          <p className="mt-3 text-[14px] font-normal text-muted-foreground">
            Generato da {coachName} · {today}
          </p>
        </header>

        {(() => {
          // Argomento critico (per i CTA Jarvis)
          const argomentoCritico = insight.learning.unclear[0] || "";
          const subj = classe?.materia || "";

          // Helper: naviga a Crea & Assegna con state Jarvis precompilato
          const goJarvis = (tipo: string, descrizione: string, studentIds?: string[]) => {
            navigate(`/classe/${classId}/materiali?create=true`, {
              state: {
                prefilledMaterial: {
                  tipo_attivita: tipo,
                  materia: subj,
                  descrizione,
                  ...(studentIds && studentIds.length ? { studentIds } : {}),
                },
              },
            });
          };

          return (
            <section className="grid gap-6 md:grid-cols-2">
              {/* 1. Apprendimento */}
              <SectionCard emoji="📊" title="Come sta andando l'apprendimento" minHeight="320px">
                <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                  {insight.learning.paragraph}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                  <button
                    onClick={() =>
                      goJarvis(
                        "recupero",
                        argomentoCritico
                          ? `Esercizi di rinforzo su ${argomentoCritico}${subj ? ` (${subj})` : ""} per chiudere le lacune ricorrenti emerse in classe.`
                          : `Esercizi di rinforzo${subj ? ` di ${subj}` : ""} sugli argomenti più critici della classe.`,
                      )
                    }
                    className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  >
                    Genera esercizi di rinforzo
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/classe/${classId}/materiali`, {
                        state: argomentoCritico ? { filtro_argomento: argomentoCritico } : undefined,
                      })
                    }
                    className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    Vedi risultati attività
                  </button>
                </div>
              </SectionCard>

              {/* 2. Metodo */}
              <SectionCard emoji="🔁" title="Il metodo sta funzionando?" minHeight="320px">
                <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                  {insight.method.paragraph}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                  <button
                    onClick={() => {
                      const topic = argomentoCritico || (subj ? `argomenti recenti di ${subj}` : "l'argomento più critico");
                      const askText = `Prepara una spiegazione alternativa di ${topic} con un esempio diverso e supporto visivo`;
                      navigate(`/classe/${classId}`, { state: { coachAsk: askText } });
                    }}
                    className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  >
                    Prepara spiegazione alternativa
                  </button>
                  <button
                    onClick={() =>
                      goJarvis(
                        "esercizi",
                        argomentoCritico
                          ? `Materiale diverso su ${argomentoCritico}${subj ? ` (${subj})` : ""}: cambia angolo di entrata, usa esempi concreti e formato più guidato.`
                          : `Materiale alternativo${subj ? ` di ${subj}` : ""} con un approccio diverso rispetto al precedente.`,
                      )
                    }
                    className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    Genera materiale diverso
                  </button>
                </div>
              </SectionCard>

              {/* 3. Clima */}
              <SectionCard emoji="💬" title="Clima della classe" minHeight="320px">
                <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                  {insight.climate.paragraph}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                  {insight.climate.hasSignals ? (
                    <>
                      <button
                        onClick={() => navigate(`/classe/${classId}?action=parent-email`)}
                        className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                      >
                        Scrivi ai genitori
                      </button>
                      <button
                        onClick={() => navigate(`/classe/${classId}`, { state: { action: "checkin" } })}
                        className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                      >
                        Avvia check-in di classe
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => navigate(`/classe/${classId}`, { state: { action: "checkin" } })}
                      className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                      Avvia check-in di classe
                    </button>
                  )}
                </div>
              </SectionCard>

              {/* 4. Studenti da seguire */}
              <SectionCard emoji="👤" title="Chi ha bisogno di attenzione" minHeight="320px">
                {insight.followStudents.length === 0 ? (
                  <>
                    <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                      Tutti gli studenti stanno procedendo regolarmente. Continuare a osservare le prossime attività per cogliere in tempo eventuali segnali di rallentamento.
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                      <button
                        onClick={() => navigate(`/classe/${classId}`)}
                        className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                      >
                        Apri classe
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                      {insight.followStudents.length === 1
                        ? `1 studente sta restando indietro rispetto al resto della classe nelle ultime attività. Conviene intervenire adesso, prima che il distacco si allarghi e diventi più difficile recuperarlo.`
                        : `${insight.followStudents.length} studenti stanno restando indietro rispetto al resto della classe nelle ultime attività. Conviene intervenire adesso, prima che il distacco si allarghi e diventi più difficile recuperarlo.`}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                      <button
                        onClick={() => {
                          const first = insight.followStudents[0];
                          navigate(`/studente/${first.studentId}?classId=${classId}`);
                        }}
                        className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                      >
                        Apri profilo
                      </button>
                      <button
                        onClick={() => {
                          const first = insight.followStudents[0];
                          goJarvis(
                            "recupero",
                            `Materiale di recupero personalizzato per ${first.studentName}${subj ? ` (${subj})` : ""}${argomentoCritico ? ` su ${argomentoCritico}` : ""}.`,
                            [first.studentId],
                          );
                        }}
                        className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                      >
                        Genera recupero
                      </button>
                    </div>
                  </>
                )}
              </SectionCard>
            </section>
          );
        })()}
      </main>
    </div>
  );
}
