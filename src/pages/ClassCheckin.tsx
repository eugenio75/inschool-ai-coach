import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, Sparkles, CloudRain, Sun, MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

// ─── Emotional taxonomy ──────────────────────────────────────────────
const HEAVY_TONES = new Set([
  "negative", "sad", "stressed", "anxious", "tired", "frustrated", "angry", "overwhelmed",
]);
const LIGHT_TONES = new Set([
  "positive", "happy", "calm", "motivated", "curious", "excited", "proud",
]);

type Climate = "sereno" | "misto" | "appesantito" | "insufficiente";

interface StudentMood {
  id: string;
  name: string;
  lastTone: "heavy" | "light" | "neutral" | null;
  heavyStreak: number;
  checkinCount7d: number;
}

function toneOf(c: any): "heavy" | "light" | "neutral" {
  const t = String(c.emotional_tone || "").toLowerCase();
  const e = String(c.energy_level || "").toLowerCase();
  if (HEAVY_TONES.has(t) || e === "low") return "heavy";
  if (LIGHT_TONES.has(t) || e === "high") return "light";
  return "neutral";
}

export default function ClassCheckin() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [moods, setMoods] = useState<StudentMood[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
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
      let emotionalCheckins: any[] = [];

      if (authSession?.access_token) {
        const data = await fetchTeacherClassData(classId!);
        loadedClasse = data.classe;
        loadedStudents = data.students || [];
        emotionalCheckins = data.emotionalCheckins || [];
      } else {
        const { data: cl } = await (supabase as any).from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
      }

      const NOW = Date.now();
      const SEVEN = 7 * 86400000;

      const rows: StudentMood[] = loadedStudents.map((s: any) => {
        const sid = s.student_id || s.id;
        const firstName = formatName(s.profile?.name || s.student_name || "Studente");
        const lastName = formatName(s.profile?.last_name || "");
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        const myCheckins = (emotionalCheckins || [])
          .filter((c: any) => c.child_profile_id === sid)
          .sort((a: any, b: any) =>
            new Date(b.created_at || b.checkin_date || 0).getTime()
            - new Date(a.created_at || a.checkin_date || 0).getTime(),
          );

        const recent = myCheckins.filter((c: any) => {
          const t = new Date(c.created_at || c.checkin_date || 0).getTime();
          return NOW - t <= SEVEN;
        });

        let heavyStreak = 0;
        for (const c of myCheckins) {
          if (toneOf(c) === "heavy") heavyStreak++;
          else break;
        }

        const lastTone = myCheckins[0] ? toneOf(myCheckins[0]) : null;

        return {
          id: sid,
          name: fullName,
          lastTone,
          heavyStreak,
          checkinCount7d: recent.length,
        };
      });

      setClasse(loadedClasse);
      setMoods(rows);
      setTotalStudents(loadedStudents.length);
    } catch (err) {
      console.error("ClassCheckin load error:", err);
    }
    setLoading(false);
  }

  // ─── Climate computation ──────────────────────────────────────────
  const stats = useMemo(() => {
    const withCheckin = moods.filter(m => m.checkinCount7d > 0);
    const heavy = moods.filter(m => m.lastTone === "heavy").length;
    const light = moods.filter(m => m.lastTone === "light").length;
    const neutral = moods.filter(m => m.lastTone === "neutral").length;
    const silent = moods.filter(m => m.checkinCount7d === 0).length;
    const longStreak = moods.filter(m => m.heavyStreak >= 3);
    const coverage = totalStudents > 0 ? withCheckin.length / totalStudents : 0;
    return { withCheckin, heavy, light, neutral, silent, longStreak, coverage };
  }, [moods, totalStudents]);

  const climate: Climate = useMemo(() => {
    if (stats.coverage < 0.3 || stats.withCheckin.length < 2) return "insufficiente";
    const heavyRatio = stats.heavy / Math.max(stats.withCheckin.length, 1);
    if (heavyRatio >= 0.4) return "appesantito";
    if (heavyRatio >= 0.2 || stats.longStreak.length > 0) return "misto";
    return "sereno";
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--muted))]/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
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

  const headline = (() => {
    switch (climate) {
      case "insufficiente":
        return {
          icon: MessageCircle,
          tone: "text-muted-foreground",
          bg: "bg-muted/50",
          title: "Per ora ho ancora poco da raccontarti",
          body: `I ragazzi stanno frequentando la classe, ma ho solo ${stats.withCheckin.length} check-in recent${stats.withCheckin.length === 1 ? "e" : "i"} su ${totalStudents} — non abbastanza per leggere davvero il clima. Un check-in collettivo, anche breve, aiuta a sentire come stanno — non solo come stanno andando.`,
        };
      case "appesantito":
        return {
          icon: CloudRain,
          tone: "text-rose-700",
          bg: "bg-rose-50",
          title: "Il clima della classe è un po' appesantito",
          body: `Diversi ragazzi stanno segnalando giornate pesanti. Potrebbe essere il momento giusto per fermarsi un attimo insieme.`,
        };
      case "misto":
        return {
          icon: Heart,
          tone: "text-amber-700",
          bg: "bg-amber-50",
          title: "Clima misto — qualcuno fa un po' più fatica",
          body: `La maggior parte sta bene, ma ${stats.heavy + stats.longStreak.length} ragazz${stats.heavy + stats.longStreak.length === 1 ? "o sta" : "i stanno"} attraversando giorni più difficili. Vale la pena un'attenzione mirata.`,
        };
      case "sereno":
      default:
        return {
          icon: Sun,
          tone: "text-emerald-700",
          bg: "bg-emerald-50",
          title: "Il clima della classe è sereno",
          body: `I ragazzi stanno bene in questi giorni. Buon momento per proporre qualcosa di nuovo o un piccolo traguardo condiviso.`,
        };
    }
  })();
  const HeadlineIcon = headline.icon;

  // Studenti da ascoltare (priorità clima): heavy o silenti dopo segnali pesanti
  const toListen = moods
    .filter(m => m.heavyStreak >= 2 || (m.lastTone === "heavy"))
    .sort((a, b) => b.heavyStreak - a.heavyStreak);

  // Studenti silenziosi (nessun check-in negli ultimi 7gg)
  const silent = moods.filter(m => m.checkinCount7d === 0);

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/30 pb-16">
      <BackLink label="al quadro" to={`/classe/${classId}/quadro`} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-10">
        {/* HEADER */}
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">
            Clima della classe
          </p>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-tight">
            {classe.nome}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Come stanno i ragazzi negli ultimi 7 giorni — {stats.withCheckin.length} di {totalStudents} si {stats.withCheckin.length === 1 ? "è raccontato" : "sono raccontati"}.
          </p>
        </header>

        {/* HEADLINE NARRATIVA */}
        <section className={`rounded-3xl ${headline.bg} border border-border/60 p-6 sm:p-7 shadow-[0_10px_28px_rgba(15,23,42,0.04)]`}>
          <div className="flex items-start gap-4">
            <div className={`shrink-0 h-11 w-11 rounded-2xl bg-card border border-border/60 flex items-center justify-center ${headline.tone}`}>
              <HeadlineIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className={`text-[18px] sm:text-[20px] font-bold leading-tight ${headline.tone}`}>
                {headline.title}
              </h2>
              <p className="mt-2 text-[14px] sm:text-[15px] text-foreground/80 leading-relaxed">
                {headline.body}
              </p>

              {climate === "insufficiente" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate(`/classe/${classId}/materiali?create=true`, {
                      state: {
                        prefilledMaterial: {
                          tipo_attivita: "lezione",
                          descrizione: "Proponi un breve check-in collettivo (5-10 minuti) per sentire come stanno i ragazzi: una domanda aperta, un giro veloce di parole o emoji, e uno spazio per chi vuole dire qualcosa in più.",
                        },
                      },
                    })}
                    className="rounded-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Proponi un check-in collettivo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/classe/${classId}/quadro`)}
                    className="rounded-full"
                  >
                    Torna al quadro
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* DISTRIBUZIONE EMOTIVA — solo se ci sono dati sufficienti */}
        {climate !== "insufficiente" && (
          <section className="mt-6 rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h3 className="text-[15px] font-bold text-foreground mb-4">
              Come si sentono in questi giorni
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-emerald-700">{stats.light}</p>
                <p className="text-[11px] font-semibold text-emerald-700/80 mt-1">Stanno bene</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-amber-700">{stats.neutral}</p>
                <p className="text-[11px] font-semibold text-amber-700/80 mt-1">Così così</p>
              </div>
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-rose-700">{stats.heavy}</p>
                <p className="text-[11px] font-semibold text-rose-700/80 mt-1">Giornate pesanti</p>
              </div>
            </div>
            {stats.silent > 0 && (
              <p className="mt-4 text-[12px] text-muted-foreground">
                {stats.silent} {stats.silent === 1 ? "ragazz* non si è" : "ragazzi non si sono"} ancora raccontat* questa settimana.
              </p>
            )}
          </section>
        )}

        {/* DA ASCOLTARE — solo se ci sono segnali */}
        {climate !== "insufficiente" && toListen.length > 0 && (
          <section className="mt-6 rounded-3xl bg-card border border-border shadow-[0_10px_28px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-border/60">
              <h3 className="text-[15px] font-bold text-foreground">
                Da ascoltare ({toListen.length})
              </h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Stanno attraversando giorni un po' più pesanti — un piccolo gesto può fare la differenza.
              </p>
            </div>
            <div className="divide-y divide-border/60">
              {toListen.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/studente/${s.id}?classId=${classId}`)}
                  className="w-full flex items-center gap-3 px-5 sm:px-6 py-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <AvatarInitials name={formatName(s.name)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-foreground truncate">
                      {formatName(s.name)}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                      {s.heavyStreak >= 3
                        ? `Da ${s.heavyStreak} check-in segnala giornate pesanti.`
                        : s.heavyStreak === 2
                          ? "Due giornate pesanti di fila."
                          : "L'ultimo check-in segnala una giornata pesante."}
                    </p>
                  </div>
                  <Heart className="h-4 w-4 text-rose-400 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* SILENZIOSI — informativo, non allarmante */}
        {climate !== "insufficiente" && silent.length > 0 && silent.length < totalStudents && (
          <section className="mt-6 rounded-2xl bg-muted/40 border border-border/60 p-5">
            <h3 className="text-[14px] font-semibold text-foreground mb-2">
              Chi non si è ancora raccontato
            </h3>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {silent.length} {silent.length === 1 ? "ragazz*" : "ragazzi"} non {silent.length === 1 ? "ha" : "hanno"} fatto check-in questa settimana. Non significa che stiano male — solo che non sappiamo. Un invito gentile può aiutare.
            </p>
          </section>
        )}

        <Separator className="my-8" />

        <p className="text-[12px] text-muted-foreground italic leading-relaxed text-center">
          Questo è uno specchio del clima — non un giudizio sui ragazzi.
        </p>
      </main>
    </div>
  );
}
