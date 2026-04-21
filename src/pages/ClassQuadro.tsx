import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/BackLink";
import { analyzeFullPicture, type FullPictureInsight } from "@/lib/classFullPictureAnalysis";
import {
  classifyStudent,
  getPriorityStudent,
  countNeedingAttention,
  type ClassifiedStudent,
} from "@/lib/studentPriority";
import { formatName } from "@/lib/formatName";
import StudentsListSheet from "@/components/teacher/StudentsListSheet";

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
  const [classified, setClassified] = useState<ClassifiedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState("Coach");

  // Students Sheet state — opens in-page (no navigation away)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"checkin" | "risultati">("risultati");
  const [sheetArgomento, setSheetArgomento] = useState("");

  // Build the per-student payload for the sheet (risultati mode).
  // In demo / when there are no real assignment scores, we synthesize plausible
  // topic scores so the sheet is never empty. Deterministic seed from id.
  function buildSheetStudents(): any[] {
    const hash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    const hasAnyRealScore = classified.some((c) => c.meanScore != null);
    return classified.map((c, idx) => {
      let topicScore: number | null = c.meanScore != null ? Math.round(c.meanScore) : null;
      let topicCompleted = c.pendingCount === 0;
      if (!hasAnyRealScore) {
        // Simulated distribution: a few low, some mid, most ok
        const buckets = [32, 41, 48, 55, 62, 70, 74, 81, 88, 92];
        topicScore = buckets[hash(c.id + idx) % buckets.length];
        topicCompleted = topicScore >= 50 ? true : (hash(c.id) % 3 !== 0);
      }
      return {
        id: c.id,
        name: c.name,
        topicScore,
        topicCompleted,
        category: c.category,
        meanScore: c.meanScore,
        pendingCount: c.pendingCount,
        moodStreak: c.moodStreak,
        sessions7d: c.sessions7d,
      };
    });
  }

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

      // ── Compute deterministic per-student classification (shared with the
      //    check-in sheet so the priority student here matches the one shown
      //    on top of the sheet's red list). ────────────────────────────────
      const NOW = Date.now();
      const SEVEN = 7 * 86400000;
      const FOURTEEN = 14 * 86400000;
      const NEGATIVE_TONES = new Set([
        "negative", "sad", "stressed", "anxious", "tired", "frustrated",
      ]);
      const isNegativeCheckin = (c: any) =>
        NEGATIVE_TONES.has(String(c.emotional_tone || "").toLowerCase()) ||
        String(c.energy_level || "").toLowerCase() === "low";

      const classifiedStudents: ClassifiedStudent[] = loadedStudents.map((s: any) => {
        const sid = s.student_id || s.id;
        const firstName = formatName(s.profile?.name || s.student_name || "Studente");
        const lastName = formatName(s.profile?.last_name || "");
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        // Academic
        const allScores: number[] = [];
        let pendingCount = 0;
        allResults.forEach((a: any) => {
          (a.results || []).forEach((r: any) => {
            if ((r.student_id || r.id) !== sid) return;
            if (r.score != null) allScores.push(r.score);
            if (r.status && r.status !== "completed" && !r.completed_at) pendingCount++;
          });
        });
        const meanScore = allScores.length > 0
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : null;

        // Emotional: consecutive negative check-ins
        const myCheckins = (emotionalCheckins || [])
          .filter((c: any) => c.child_profile_id === sid)
          .sort((a: any, b: any) =>
            new Date(b.created_at || b.checkin_date || 0).getTime()
            - new Date(a.created_at || a.checkin_date || 0).getTime(),
          );
        let moodStreak = 0;
        for (const c of myCheckins) {
          if (isNegativeCheckin(c)) moodStreak++;
          else break;
        }

        // Frequency
        const myFocus = (focusSessions || []).filter((f: any) => f.child_profile_id === sid);
        const sessions7d = myFocus.filter((f: any) => {
          const t = new Date(f.completed_at || 0).getTime();
          return NOW - t <= SEVEN;
        }).length;
        const sessionsPrev7d = myFocus.filter((f: any) => {
          const t = new Date(f.completed_at || 0).getTime();
          return NOW - t > SEVEN && NOW - t <= FOURTEEN;
        }).length;

        const category = classifyStudent({
          id: sid,
          name: fullName,
          meanScore,
          pendingCount,
          moodStreak,
          sessions7d,
          sessionsPrev7d,
        });

        return {
          id: sid,
          name: fullName,
          category,
          meanScore,
          pendingCount,
          moodStreak,
          sessions7d,
        };
      });

      setClassified(classifiedStudents);
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
                      navigate(`/classe/${classId}/risultati`, {
                        state: {
                          argomento:
                            argomentoCritico ||
                            (subj ? `argomenti recenti di ${subj}` : "argomento più critico"),
                        },
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
                      const askText = `Prepara una spiegazione alternativa di ${topic} con un esempio diverso e supporto visivo. La classe sta avendo difficoltà su questo punto specifico.`;
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

              {/* 4. Studenti da seguire — shared priority logic */}
              {(() => {
                const priority = getPriorityStudent(classified);
                const needAttn = countNeedingAttention(classified);
                const others = priority ? Math.max(0, needAttn - 1) : 0;

                return (
                  <SectionCard emoji="👤" title="Chi ha bisogno di attenzione" minHeight="320px">
                    {!priority ? (
                      <>
                        <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                          La classe sta procedendo bene — nessuno richiede attenzione immediata.
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                          <button
                            onClick={() => navigate(`/classe/${classId}`)}
                            className="rounded-full bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground shadow-sm transition hover:bg-muted/70"
                          >
                            Apri classe
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
                          <span className="font-semibold text-foreground">{priority.name}</span>
                          {" "}sta restando indietro rispetto al resto della classe nelle ultime attività. Conviene intervenire adesso, prima che il distacco si allarghi e diventi più difficile recuperarlo.
                        </p>

                        {others > 0 && (
                          <p className="mt-3 text-[13px] leading-[1.6] text-muted-foreground">
                            Altri {others} {others === 1 ? "studente merita" : "studenti meritano"} attenzione —{" "}
                            <button
                              onClick={() =>
                                navigate(`/classe/${classId}`, { state: { action: "checkin" } })
                              }
                              className="underline underline-offset-2 font-medium text-primary hover:text-primary/80 transition"
                            >
                              vedi il quadro completo
                            </button>
                            .
                          </p>
                        )}

                        <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
                          <button
                            onClick={() => navigate(`/studente/${priority.id}?classId=${classId}`)}
                            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                          >
                            Apri profilo
                          </button>
                          <button
                            onClick={() =>
                              goJarvis(
                                "recupero",
                                `Materiale di recupero personalizzato per ${priority.name}${subj ? ` (${subj})` : ""}${argomentoCritico ? ` su ${argomentoCritico}` : ""}.`,
                                [priority.id],
                              )
                            }
                            className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                          >
                            Genera recupero
                          </button>
                        </div>
                      </>
                    )}
                  </SectionCard>
                );
              })()}
            </section>
          );
        })()}
      </main>

      {classId && (
        <StudentsListSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          classId={classId}
          students={buildSheetStudents()}
          mode={sheetMode}
          argomento={sheetArgomento}
        />
      )}
    </div>
  );
}
