import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, FileText, Plus, Send, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import TeacherMaterialsTab from "@/components/teacher/TeacherMaterialsTab";
import { BackLink } from "@/components/shared/BackLink";

interface ClassInfo {
  id: string;
  nome: string;
  materia: string | null;
}

interface MaterialRow {
  id: string;
  title: string;
  subject: string | null;
  type: string | null;
  level: string | null;
  status: string | null;
  class_id: string | null;
  assigned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function ClassMaterials() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classe, setClasse] = useState<ClassInfo | null>(null);
  const [assigned, setAssigned] = useState<MaterialRow[]>([]);
  const [drafts, setDrafts] = useState<MaterialRow[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Prefilled material coming from ClassQuadro CTAs (Genera con Jarvis)
  const prefilledMaterial = (location.state as any)?.prefilledMaterial || null;
  // If we have a prefilled material we automatically enter create mode
  const createMode = searchParams.get("create") === "true" || !!prefilledMaterial;

  useEffect(() => {
    if (!classId || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, user]);

  async function load() {
    setLoading(true);
    try {
      // Use teacher-class-data edge function (same as ClassView) to bypass RLS edge cases
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-class-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ classId }),
      });
      if (!resp.ok) throw new Error("class_not_found");
      const data = await resp.json();
      const c = data.classe;
      if (!c) {
        toast.error("Classe non trovata");
        navigate("/dashboard");
        return;
      }
      setClasse({ id: c.id, nome: c.nome, materia: c.materia });

      // Materials assigned to this class
      const { data: assignedData } = await supabase
        .from("teacher_materials")
        .select("id, title, subject, type, level, status, class_id, assigned_at, created_at, updated_at")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId!)
        .order("updated_at", { ascending: false });

      // Drafts of the same subject not yet assigned
      let draftsQ = supabase
        .from("teacher_materials")
        .select("id, title, subject, type, level, status, class_id, assigned_at, created_at, updated_at")
        .eq("teacher_id", user!.id)
        .is("assigned_at", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (c.materia) draftsQ = draftsQ.eq("subject", c.materia);
      const { data: draftsData } = await draftsQ;

      // Students from edge function payload
      const studentList = (data.students || []).map((s: any) => s.profile || s).filter(Boolean);

      setAssigned((assignedData || []) as MaterialRow[]);
      setDrafts((draftsData || []) as MaterialRow[]);
      setStudents(studentList);
    } catch (err) {
      console.error("ClassMaterials.load", err);
      toast.error("Errore nel caricamento dei materiali");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function assignDraft(id: string) {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("teacher_materials")
        .update({ class_id: classId, assigned_at: new Date().toISOString(), status: "assigned" })
        .eq("id", id)
        .eq("teacher_id", user!.id);
      if (error) throw error;
      toast.success("Materiale assegnato alla classe");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Errore nell'assegnazione");
    } finally {
      setBusyId(null);
    }
  }

  function openMaterial(id: string) {
    navigate(`/materiali-docente?materialId=${id}&classId=${classId}`);
  }

  function openCreate() {
    setSearchParams({ create: "true" }, { replace: false });
  }

  function closeCreate() {
    setSearchParams({}, { replace: true });
    void load();
  }

  // Create mode: render the full material generator inline
  if (createMode && classe && user) {
    return (
      <div className="min-h-screen bg-muted/30 relative">
        <BackLink label="ai materiali della classe" to={`/classe/${classId}?tab=materiali`} />
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-3 sm:py-4 pb-24">
          <TeacherMaterialsTab
            classId={classId!}
            classe={classe}
            students={students}
            materials={[...assigned, ...drafts]}
            userId={user.id}
            onReload={load}
            autoCreate={true}
            hideSaved={true}
            prefilledMaterial={prefilledMaterial}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
      <BackLink label="alla classe" to={`/classe/${classId}`} />
      <div className="max-w-[880px] mx-auto px-4 sm:px-8 py-3 sm:py-4 pb-24">
        {/* Header */}
        <header className="mb-5 sm:mb-6 rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                Materiali della classe
              </p>
              <h1 className="mt-2 text-[28px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none">
                {classe?.nome || "Classe"}
              </h1>
              {classe?.materia && (
                <p className="mt-3 text-[16px] text-muted-foreground">{classe.materia}</p>
              )}
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Crea nuovo
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Assigned to class */}
            <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7 mb-5">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground">Assegnati a questa classe</h2>
                  <p className="text-[15px] text-muted-foreground mt-1">
                    {assigned.length} {assigned.length === 1 ? "materiale" : "materiali"}
                  </p>
                </div>
              </div>

              {assigned.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-border/70 p-6 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-[16px] text-muted-foreground">
                    Nessun materiale assegnato a questa classe.
                  </p>
                  <Button onClick={openCreate} variant="outline" size="sm" className="mt-3 gap-2">
                    <Plus className="h-4 w-4" /> Crea il primo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {assigned.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openMaterial(m.id)}
                      className="w-full text-left rounded-[18px] border border-border/70 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[17px] font-semibold text-foreground line-clamp-1">{m.title}</p>
                          <p className="mt-1.5 text-[14px] text-muted-foreground flex items-center gap-2 flex-wrap">
                            {m.type && <span className="capitalize">{m.type}</span>}
                            {m.subject && <><span>·</span><span>{m.subject}</span></>}
                            {m.assigned_at && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(m.assigned_at).toLocaleDateString("it-IT")}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Drafts of same subject */}
            {drafts.length > 0 && (
              <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
                <div className="mb-4">
                  <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground">
                    Bozze pertinenti{classe?.materia ? ` · ${classe.materia}` : ""}
                  </h2>
                  <p className="text-[15px] text-muted-foreground mt-1">
                    Materiali non ancora assegnati che puoi riutilizzare per questa classe
                  </p>
                </div>

                <div className="space-y-2.5">
                  {drafts.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-[18px] border border-border/70 p-4 flex items-start justify-between gap-3"
                    >
                      <button
                        onClick={() => openMaterial(m.id)}
                        className="min-w-0 text-left flex-1"
                      >
                        <p className="text-[17px] font-semibold text-foreground line-clamp-1">{m.title}</p>
                        <p className="mt-1.5 text-[14px] text-muted-foreground flex items-center gap-2 flex-wrap">
                          {m.type && <span className="capitalize">{m.type}</span>}
                          {m.subject && <><span>·</span><span>{m.subject}</span></>}
                          <span>·</span>
                          <span className="text-muted-foreground/80 italic">Bozza</span>
                        </p>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === m.id}
                        onClick={() => assignDraft(m.id)}
                        className="gap-1.5 shrink-0"
                      >
                        {busyId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Assegna
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
