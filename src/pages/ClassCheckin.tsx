import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BackLink } from "@/components/shared/BackLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { formatName } from "@/lib/formatName";
import {
  classifyStudent,
  sortByPriority,
  type ClassifiedStudent,
} from "@/lib/studentPriority";

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

const NEGATIVE_TONES = new Set([
  "negative", "sad", "stressed", "anxious", "tired", "frustrated",
]);
const isNegativeCheckin = (c: any) =>
  NEGATIVE_TONES.has(String(c.emotional_tone || "").toLowerCase()) ||
  String(c.energy_level || "").toLowerCase() === "low";

export default function ClassCheckin() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [classified, setClassified] = useState<ClassifiedStudent[]>([]);
  const [loading, setLoading] = useState(true);

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
      let emotionalCheckins: any[] = [];
      let focusSessions: any[] = [];

      if (authSession?.access_token) {
        const data = await fetchTeacherClassData(classId!);
        loadedClasse = data.classe;
        loadedStudents = data.students || [];
        loadedResults = data.assignmentResults || [];
        emotionalCheckins = data.emotionalCheckins || [];
        focusSessions = data.focusSessions || [];
      } else {
        const { data: cl } = await (supabase as any).from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
      }

      const NOW = Date.now();
      const SEVEN = 7 * 86400000;
      const FOURTEEN = 14 * 86400000;

      const rows: ClassifiedStudent[] = loadedStudents.map((s: any) => {
        const sid = s.student_id || s.id;
        const firstName = formatName(s.profile?.name || s.student_name || "Studente");
        const lastName = formatName(s.profile?.last_name || "");
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        const allScores: number[] = [];
        let pendingCount = 0;
        loadedResults.forEach((a: any) => {
          (a.results || []).forEach((r: any) => {
            if ((r.student_id || r.id) !== sid) return;
            if (r.score != null) allScores.push(r.score);
            if (r.status && r.status !== "completed" && !r.completed_at) pendingCount++;
          });
        });
        const meanScore = allScores.length > 0
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : null;

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

        return { id: sid, name: fullName, category, meanScore, pendingCount, moodStreak, sessions7d };
      });

      setClasse(loadedClasse);
      setClassified(rows);
    } catch (err) {
      console.error("ClassCheckin load error:", err);
    }
    setLoading(false);
  }

  const counts = useMemo(() => {
    return classified.reduce(
      (acc, s) => {
        if (s.category === "attenzione") acc.attenzione++;
        else if (s.category === "occhio") acc.occhio++;
        else acc.norma++;
        return acc;
      },
      { attenzione: 0, occhio: 0, norma: 0 },
    );
  }, [classified]);

  const sorted = useMemo(() => sortByPriority(classified), [classified]);

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

  const dotClass = (c: ClassifiedStudent["category"]) =>
    c === "attenzione"
      ? "bg-red-500"
      : c === "occhio"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const summaryLine = (c: ClassifiedStudent["category"]) =>
    c === "attenzione"
      ? "Risultati in calo e attività non completate — contatto diretto consigliato."
      : c === "occhio"
        ? "Un segnale da monitorare — tieni d'occhio nelle prossime sessioni."
        : "Sta procedendo regolarmente.";

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/30 pb-16">
      <BackLink label="al quadro" to={`/classe/${classId}/quadro`} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-10">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">
            Check-in di classe
          </p>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-tight">
            {classe.nome}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Sintesi degli ultimi 7 giorni — {classified.length} {classified.length === 1 ? "studente" : "studenti"}.
          </p>
        </header>

        {/* BLOCCO 1 — RIEPILOGO */}
        <section className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{counts.attenzione}</p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Attenzione
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{counts.occhio}</p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Da tenere d'occhio
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{counts.norma}</p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Nella norma
              </p>
            </div>
          </div>
        </section>

        {/* BLOCCO 2 — LISTA STUDENTI CLASSIFICATI */}
        <section className="mt-6 rounded-3xl bg-card border border-border shadow-[0_10px_28px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-border/60">
            <h2 className="text-[15px] font-bold text-foreground">
              Studenti ({sorted.length})
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Ordinati per priorità — chi ha più bisogno appare in cima.
            </p>
          </div>

          {sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">Nessuno studente iscritto.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {sorted.map((s) => {
                const isAttenzione = s.category === "attenzione";
                return (
                  <div key={s.id} className="px-5 sm:px-6 py-4 hover:bg-muted/40 transition-colors">
                    <button
                      onClick={() => navigate(`/studente/${s.id}?classId=${classId}`)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <AvatarInitials name={formatName(s.name)} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass(s.category)}`} />
                          <p className="text-[15px] font-medium text-foreground truncate">
                            {formatName(s.name)}
                          </p>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                          {summaryLine(s.category)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>

                    {isAttenzione && (
                      <div className="mt-3 ml-12 flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/studente/${s.id}?classId=${classId}`);
                          }}
                          className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Apri profilo
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/classe/${classId}/materiali?create=true`, {
                              state: {
                                prefilledMaterial: {
                                  tipo_attivita: "recupero",
                                  studentIds: [s.id],
                                  descrizione: `Materiale di recupero personalizzato per ${s.name}.`,
                                },
                              },
                            });
                          }}
                          className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                        >
                          Genera recupero
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Separator className="my-8" />

        <p className="text-[12px] text-muted-foreground italic leading-relaxed text-center">
          Questo quadro è una sintesi degli ultimi 7 giorni — non una valutazione permanente.
        </p>
      </main>
    </div>
  );
}
