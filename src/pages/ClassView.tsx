import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Users, BookOpen, MessageSquare,
  Copy, ChevronRight, ChevronDown, AlertTriangle,
  BarChart2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TeacherMaterialsTab from "@/components/teacher/TeacherMaterialsTab";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nel caricamento della classe");
  }
  return response.json();
}

/* ─── helpers ─── */
function computeClassStats(students: any[], assignmentResults: any[]) {
  const totalStudents = students.length;
  if (totalStudents === 0) return { avg: 0, completion: 0, regular: 0, toFollow: 0, statusMsg: "Nessuno studente iscritto" };

  let totalScore = 0;
  let totalCompleted = 0;
  let totalAssigned = 0;

  const studentScores: Record<string, number[]> = {};

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const sid = r.student_id || r.id;
      if (!studentScores[sid]) studentScores[sid] = [];
      if (r.score != null) {
        totalScore += r.score;
        studentScores[sid].push(r.score);
      }
      totalAssigned++;
      if (r.status === "completed") totalCompleted++;
    });
  });

  const avg = totalAssigned > 0 ? Math.round(totalScore / totalAssigned) : 0;
  const completion = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  // Students below 60% avg → "da seguire"
  let toFollow = 0;
  Object.values(studentScores).forEach(scores => {
    if (scores.length > 0) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (mean < 60) toFollow++;
    }
  });

  const regular = totalStudents - toFollow;
  let statusMsg = "La classe procede regolarmente";
  if (toFollow >= 3) statusMsg = `${toFollow} studenti da seguire`;
  else if (toFollow > 0) statusMsg = `${toFollow} student${toFollow === 1 ? "e" : "i"} da seguire`;

  return { avg, completion, regular, toFollow, statusMsg, studentScores };
}

function getStudentBadge(studentId: string, studentScores: Record<string, number[]> | undefined, assignmentResults: any[]) {
  if (!studentScores) return null;
  const scores = studentScores[studentId];
  if (!scores || scores.length === 0) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Check late assignments
  let lateCount = 0;
  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      if ((r.student_id || r.id) === studentId && r.status !== "completed") lateCount++;
    });
  });

  if (mean < 50 || lateCount >= 3) return { label: "Da seguire", variant: "destructive" as const };
  if (lateCount >= 2) return { label: "In ritardo", variant: "secondary" as const };
  if (scores.length >= 2 && scores[scores.length - 1] > scores[scores.length - 2] + 10) return { label: "In miglioramento", variant: "default" as const };
  return null;
}

function isStudentBelowThreshold(studentId: string, studentScores: Record<string, number[]> | undefined) {
  if (!studentScores) return false;
  const scores = studentScores[studentId];
  if (!scores || scores.length === 0) return false;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return mean < 50;
}

/* ─── topics from assignments ─── */
function computeTopicMastery(assignmentResults: any[]) {
  const topicMap: Record<string, { total: number; sum: number }> = {};
  assignmentResults.forEach((a: any) => {
    const topic = a.subject || a.title || "Generale";
    if (!topicMap[topic]) topicMap[topic] = { total: 0, sum: 0 };
    (a.results || []).forEach((r: any) => {
      topicMap[topic].total++;
      topicMap[topic].sum += r.score || 0;
    });
  });
  return Object.entries(topicMap).map(([name, d]) => ({
    name,
    mastery: d.total > 0 ? Math.round(d.sum / d.total) : 0,
  }));
}

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignmentResults, setAssignmentResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "classe";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [verificheOpen, setVerificheOpen] = useState(false);

  useEffect(() => {
    if (!classId || (!profileId && !user)) return;
    loadClass();
  }, [classId, profileId, user]);

  async function loadClass() {
    setLoading(true);
    try {
      if (user) {
        const data = await fetchTeacherClassData(classId!);
        setClasse(data.classe);
        setStudents(data.students || []);
        setAssignmentResults(data.assignmentResults || []);

        const { data: mats } = await (supabase as any)
          .from("teacher_materials")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("class_id", classId)
          .order("created_at", { ascending: false });
        setMaterials(mats || []);
      } else {
        const { data: cl } = await (supabase as any)
          .from("classi").select("*").eq("id", classId).single();
        setClasse(cl);
        const { data: enr } = await (supabase as any)
          .from("class_enrollments").select("*").eq("class_id", classId).eq("status", "active");
        const enrollments = enr || [];
        if (enrollments.length > 0) {
          const studentIds = enrollments.map((e: any) => e.student_id);
          const { data: profiles } = await (supabase as any)
            .from("child_profiles")
            .select("id, name, parent_id, avatar_emoji, school_level")
            .in("parent_id", studentIds);
          const profileMap: Record<string, any> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.parent_id] = p; });
          setStudents(enrollments.map((e: any) => ({ ...e, profile: profileMap[e.student_id] || null })));
        } else {
          setStudents([]);
        }
        setAssignmentResults([]);
        setMaterials([]);
      }
    } catch (error) {
      console.error("loadClass error:", error);
      toast.error("Non sono riuscito a caricare la classe.");
      setStudents([]);
      setAssignmentResults([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Classe non trovata.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-4">Torna alla dashboard</Button>
      </div>
    );
  }

  const stats = computeClassStats(students, assignmentResults);
  const topics = computeTopicMastery(assignmentResults);

  // Feedback loop alerts
  const feedbackAlerts: string[] = [];
  assignmentResults.forEach((a: any) => {
    const results = a.results || [];
    const notCompleted = results.filter((r: any) => r.status !== "completed").length;
    if (notCompleted >= 6) feedbackAlerts.push(`"${a.title}": ${notCompleted} studenti non hanno completato — proponi un follow-up.`);

    // Common errors
    const errorCounts: Record<string, number> = {};
    results.forEach((r: any) => {
      const summary = r.errors_summary;
      if (summary && typeof summary === "object") {
        Object.keys(summary).forEach(k => { errorCounts[k] = (errorCounts[k] || 0) + 1; });
      }
    });
    Object.entries(errorCounts).forEach(([err, count]) => {
      if (count >= 4) feedbackAlerts.push(`"${a.title}": ${count} studenti con errore su "${err}" — suggerisci recupero mirato.`);
    });
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* ─── Header — solid color, no gradient ─── */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        <div className="bg-[hsl(var(--primary))] rounded-2xl p-6 text-primary-foreground relative">
          <div>
            <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wider mb-1">Classe</p>
            <h1 className="text-2xl font-bold">{classe.nome}</h1>
            <div className="flex items-center gap-3 mt-2">
              {classe.materia && (
                <span className="text-sm bg-primary-foreground/20 px-3 py-0.5 rounded-full font-medium">{classe.materia}</span>
              )}
              <span className="text-sm text-primary-foreground/70">{students.length} studenti</span>
              {classe.ordine_scolastico && (
                <span className="text-sm text-primary-foreground/50">{classe.ordine_scolastico}</span>
              )}
            </div>
          </div>
          {/* Code — small, bottom-right */}
          <div className="absolute bottom-3 right-5 flex items-center gap-1.5">
            <span className="text-[10px] text-primary-foreground/40 uppercase tracking-wider">Codice:</span>
            <span className="font-mono text-xs font-semibold text-primary-foreground/60 tracking-widest">{classe.codice_invito}</span>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 p-1 rounded transition-colors"
            >
              <Copy className="w-3 h-3 text-primary-foreground/50" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tabs — 3 voci ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 rounded-xl">
          <TabsTrigger value="classe" className="text-xs rounded-lg">
            <Users className="w-3.5 h-3.5 mr-1" /> La classe
          </TabsTrigger>
          <TabsTrigger value="materiali" className="text-xs rounded-lg">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Materiali
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Coach AI
          </TabsTrigger>
        </TabsList>

        {/* ━━━ TAB: LA CLASSE ━━━ */}
        <TabsContent value="classe" className="mt-6 space-y-5">
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nessuno studente ancora</p>
              <p className="text-sm text-muted-foreground mb-4">
                Condividi il codice classe per invitare gli studenti
              </p>
              <div className="bg-muted rounded-xl py-3 px-4 inline-block mb-3">
                <span className="font-mono font-bold text-2xl tracking-widest text-foreground">
                  {classe.codice_invito}
                </span>
              </div>
              <br />
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => { navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copia codice
              </Button>
            </div>
          ) : (
            <>
              {/* BLOCK 1 — Stato aggregato */}
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  stats.toFollow === 0 ? "bg-emerald-500" : stats.toFollow >= 3 ? "bg-amber-500" : "bg-amber-400"
                )} />
                <p className="text-sm font-medium text-foreground">{stats.statusMsg}</p>
              </div>

              {/* BLOCK 2 — KPI */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Media classe", value: `${stats.avg}%` },
                  { label: "Completamento", value: `${stats.completion}%` },
                  { label: "Continuità regolare", value: stats.regular },
                  { label: "Da seguire", value: stats.toFollow },
                ].map((kpi, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* BLOCK 3 — Andamento per argomento */}
              {topics.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Andamento per argomento
                  </p>
                  <div className="space-y-3">
                    {topics.map((t, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground">{t.name}</span>
                          <span className="text-xs text-muted-foreground font-medium">{t.mastery}%</span>
                        </div>
                        <Progress value={t.mastery} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOCK 4 — Lista studenti */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Studenti ({students.length})
                </p>
                <div className="space-y-2">
                  {students.map((s: any) => {
                    const name = s.profile?.name || s.student_name || "Studente";
                    const sid = s.student_id || s.id;
                    const badge = getStudentBadge(sid, stats.studentScores as any, assignmentResults);
                    const belowThreshold = isStudentBelowThreshold(sid, stats.studentScores as any);

                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/studente/${sid}?classId=${classId}`)}
                        className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 hover:shadow-sm transition-all text-left"
                      >
                        <AvatarInitials name={name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{name}</p>
                        </div>
                        {badge && (
                          <Badge variant={badge.variant} className="text-[10px] shrink-0">
                            {badge.label}
                          </Badge>
                        )}
                        {belowThreshold && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BLOCK 5 — Risultati verifiche (collapsible, default closed) */}
              {assignmentResults.length > 0 && (
                <div className="bg-card border border-border rounded-xl">
                  <button
                    onClick={() => setVerificheOpen(!verificheOpen)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5" />
                      Risultati verifiche ({assignmentResults.length})
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      verificheOpen && "rotate-180"
                    )} />
                  </button>

                  {verificheOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {assignmentResults.map((a: any) => {
                        const results = a.results || [];
                        const avgScore = results.length > 0
                          ? Math.round(results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length)
                          : 0;
                        const completed = results.filter((r: any) => r.status === "completed").length;

                        return (
                          <div key={a.id} className="border border-border rounded-xl p-4 bg-muted/30">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {a.subject} · {a.type === "verifica" ? "Verifica" : "Compito"}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-foreground">{avgScore}%</p>
                                  <p className="text-[10px] text-muted-foreground">media</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-foreground">{completed}/{results.length}</p>
                                  <p className="text-[10px] text-muted-foreground">completati</p>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-3 border-t border-border">
                              {results.map((r: any) => {
                                const rName = r.student_name || "Studente";
                                const rScore = r.score != null ? Math.round(r.score) : null;
                                const belowThreshold = rScore != null && rScore < 50;
                                let statusLabel = "Non iniziato";
                                let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                                if (r.status === "completed") { statusLabel = "Completato"; statusVariant = "default"; }
                                else if (r.status === "in_progress") { statusLabel = "In corso"; statusVariant = "secondary"; }
                                else if (r.status === "assigned" && a.due_date && new Date(a.due_date) < new Date()) {
                                  statusLabel = "In ritardo"; statusVariant = "destructive";
                                }

                                return (
                                  <div key={r.id} className="flex items-center gap-2 text-xs">
                                    <AvatarInitials name={rName} size="sm" />
                                    <span className="flex-1 text-foreground truncate">{rName}</span>
                                    {belowThreshold && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                                    <span className="font-semibold text-foreground">
                                      {rScore != null ? `${rScore}%` : "—"}
                                    </span>
                                    <Badge variant={statusVariant} className="text-[10px]">
                                      {statusLabel}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Feedback loop alerts for this assignment */}
                            {(() => {
                              const notDone = results.filter((r: any) => r.status !== "completed").length;
                              const alerts: string[] = [];
                              if (notDone >= 6) alerts.push(`${notDone} studenti non hanno completato — considera un follow-up.`);
                              const errCounts: Record<string, number> = {};
                              results.forEach((r: any) => {
                                if (r.errors_summary && typeof r.errors_summary === "object") {
                                  Object.keys(r.errors_summary).forEach(k => { errCounts[k] = (errCounts[k] || 0) + 1; });
                                }
                              });
                              Object.entries(errCounts).forEach(([err, cnt]) => {
                                if (cnt >= 4) alerts.push(`${cnt} studenti con errore su "${err}" — suggerisci recupero mirato.`);
                              });
                              if (alerts.length === 0) return null;
                              return (
                                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                                  {alerts.map((msg, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      <span>{msg}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* BLOCK 6 — Disclaimer */}
              <p className="text-xs text-muted-foreground text-center pt-2 pb-4">
                I segnali di attenzione sono aggregati anonimi. Per i dettagli individuali clicca sul nome dello studente.
              </p>
            </>
          )}
        </TabsContent>

        {/* ━━━ TAB: MATERIALI ━━━ */}
        <TabsContent value="materiali" className="mt-6">
          <TeacherMaterialsTab
            classId={classId!}
            classe={classe}
            students={students}
            materials={materials}
            userId={user!.id}
            onReload={loadClass}
            autoCreate={searchParams.get("create") === "true"}
          />
        </TabsContent>

        {/* ━━━ TAB: COACH AI ━━━ */}
        <TabsContent value="coach" className="mt-6">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">Coach AI per {classe.nome}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {students.length === 0
                ? "La classe è vuota ma puoi già generare materiali e pianificare attività."
                : "Chiedi consigli su questa classe, piani di recupero o strategie didattiche."
              }
            </p>
            <Button className="rounded-xl" onClick={() => navigate("/challenge/new")}>
              <MessageSquare className="w-4 h-4 mr-1" /> Apri il Coach AI
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
