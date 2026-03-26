import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Heart, BookOpen, MessageSquare,
  Copy, CheckCircle2, ChevronRight, BarChart2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TeacherMaterialsTab from "@/components/teacher/TeacherMaterialsTab";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
        let profilesList: any[] = [];
        if (enrollments.length > 0) {
          const studentIds = enrollments.map((e: any) => e.student_id);
          const { data: profiles } = await (supabase as any)
            .from("child_profiles")
            .select("id, name, parent_id, avatar_emoji, school_level")
            .in("parent_id", studentIds);
          profilesList = profiles || [];

          const profileMap: Record<string, any> = {};
          profilesList.forEach((p: any) => { profileMap[p.parent_id] = p; });

          const enriched = enrollments.map((e: any) => ({
            ...e,
            profile: profileMap[e.student_id] || null,
          }));
          setStudents(enriched);
        } else {
          setStudents([]);
        }

        setAssignmentResults([]);
        setMaterials([]);
      }
    } catch (error) {
      console.error("loadClass error:", error);
      toast.error("Non sono riuscito a caricare studenti e risultati.");
      setStudents([]);
      setAssignmentResults([]);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
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


  const matLower = (classe.materia || '').toLowerCase();
  const gradientMap: Record<string, string> = {
    'musica': 'from-violet-500 to-fuchsia-500',
    'educazione civica': 'from-emerald-500 to-teal-500',
    'italiano': 'from-sky-500 to-blue-500',
    'matematica': 'from-orange-500 to-amber-500',
    'storia': 'from-rose-500 to-red-500',
    'scienze': 'from-green-500 to-lime-500',
    'inglese': 'from-indigo-500 to-blue-500',
  };
  const gradient = gradientMap[matLower] || 'from-[#1A3A5C] to-[#0070C0]';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Classe</p>
              <h1 className="text-2xl font-bold">{classe.nome}</h1>
              <div className="flex items-center gap-3 mt-2">
                {classe.materia && (
                  <span className="text-sm bg-white/20 px-3 py-0.5 rounded-full font-medium">{classe.materia}</span>
                )}
                <span className="text-sm text-white/80">{students.length} studenti</span>
                {classe.ordine_scolastico && (
                  <span className="text-sm text-white/60">{classe.ordine_scolastico}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Codice classe</p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-2xl tracking-[0.2em]">{classe.codice_invito}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}
                  className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 rounded-xl">
          <TabsTrigger value="classe" className="text-xs rounded-lg">
            <Users className="w-3.5 h-3.5 mr-1" /> La classe
          </TabsTrigger>
          <TabsTrigger value="benessere" className="text-xs rounded-lg">
            <Heart className="w-3.5 h-3.5 mr-1" /> Benessere
          </TabsTrigger>
          <TabsTrigger value="materiali" className="text-xs rounded-lg">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Materiali
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Coach AI
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: La classe */}
        <TabsContent value="classe" className="mt-6 space-y-4">
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
            <div className="space-y-6">
              {/* Risultati verifiche */}
              {assignmentResults.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5" /> Risultati verifiche
                  </p>
                  <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {assignmentResults.map((a: any) => {
                      const avgScore = a.results.length > 0
                        ? Math.round(a.results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / a.results.length)
                        : 0;
                      const completed = a.results.filter((r: any) => r.status === 'completed').length;
                      return (
                        <div key={a.id} className="border border-border rounded-xl p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {a.subject} · {a.type === 'verifica' ? 'Verifica' : 'Compito'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-center">
                                <p className={`text-lg font-bold ${avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {avgScore}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">media</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-foreground">{completed}/{a.results.length}</p>
                                <p className="text-[10px] text-muted-foreground">completati</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1 mt-3 pt-3 border-t border-border">
                            {a.results.map((r: any) => (
                              <div key={r.id} className="flex items-center gap-2 text-xs">
                                <AvatarInitials name={r.student_name} size="sm" />
                                <span className="flex-1 text-foreground truncate">{r.student_name}</span>
                                <span className={`font-semibold ${(r.score || 0) >= 70 ? 'text-green-600' : (r.score || 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {r.score != null ? `${Math.round(r.score)}%` : '—'}
                                </span>
                                <Badge variant={r.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                  {r.status === 'completed' ? 'Completato' : r.status === 'in_progress' ? 'In corso' : 'Assegnato'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista studenti */}
              <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Studenti ({students.length})
              </p>
              {students.map((s: any) => {
                const name = s.profile?.name || "Studente";
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/studente/${s.student_id}?classId=${classId}`)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 hover:shadow-sm transition-all text-left"
                  >
                    <AvatarInitials name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.profile?.school_level || "Iscritto"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Attivo</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Benessere */}
        <TabsContent value="benessere" className="mt-6">
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nessun dato ancora</p>
              <p className="text-sm text-muted-foreground">
                I segnali appariranno quando gli studenti inizieranno a usare l'app.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <p className="font-medium text-foreground">La classe procede regolarmente</p>
                <p className="text-sm text-muted-foreground mt-1">Nessun segnale rilevante</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "studenti con segnali da osservare", value: 0, color: "text-amber-600" },
                  { label: "studenti con continuità regolare", value: students.length, color: "text-green-600" },
                  { label: "studenti con calo recente", value: 0, color: "text-amber-600" },
                  { label: "sessioni questa settimana", value: 0, color: "text-blue-600" },
                ].map((item, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-5">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                I dati mostrati sono aggregati anonimi. Per vedere i dettagli di un singolo studente,
                vai alla tab "La classe" e clicca sul suo nome.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Materiali */}
        <TabsContent value="materiali" className="mt-6">
          <TeacherMaterialsTab
            classId={classId!}
            classe={classe}
            students={students}
            materials={materials}
            userId={user!.id}
            onReload={loadClass}
          />
        </TabsContent>

        {/* Tab 4: Coach AI */}
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
