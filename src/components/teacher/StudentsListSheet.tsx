import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { ChevronRight } from "lucide-react";
import { formatName } from "@/lib/formatName";

type Category = "attenzione" | "occhio" | "norma";

interface Student {
  id: string;
  name: string;
  lastActivity?: string;
  needsFollow?: boolean;
  // Risultati mode (optional)
  topicScore?: number | null;
  topicCompleted?: boolean;
  // Check-in classification (optional)
  category?: Category;
  meanScore?: number | null;
  pendingCount?: number;
  moodStreak?: number;
  sessions7d?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  students: Student[];
  mode?: "checkin" | "risultati";
  argomento?: string;
}

function readingLine(mean: number): string {
  if (mean < 50) {
    return "La maggior parte della classe è in difficoltà su questo argomento — riprendilo prima di andare avanti.";
  }
  if (mean <= 70) {
    return "Parte della classe ha difficoltà — valuta un esercizio di rinforzo.";
  }
  return "La classe sta andando bene su questo argomento.";
}

export default function StudentsListSheet({
  open,
  onOpenChange,
  classId,
  students,
  mode = "checkin",
  argomento = "",
}: Props) {
  const navigate = useNavigate();

  // ─── Risultati mode ──────────────────────────────────────────
  if (mode === "risultati") {
    const total = students.length;
    const withScore = students.filter((s) => typeof s.topicScore === "number");
    const completedCount = students.filter((s) => s.topicCompleted).length;
    const belowFifty = withScore.filter((s) => (s.topicScore ?? 0) < 50).length;
    const meanScore =
      withScore.length > 0
        ? Math.round(
            withScore.reduce((acc, s) => acc + (s.topicScore ?? 0), 0) / withScore.length,
          )
        : null;

    // Sort: lowest score first, then no-score, then by name
    const sorted = [...students].sort((a, b) => {
      const sa = typeof a.topicScore === "number" ? a.topicScore : Number.POSITIVE_INFINITY;
      const sb = typeof b.topicScore === "number" ? b.topicScore : Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <SheetTitle className="text-base">
              Risultati su: <span className="text-primary">{argomento || "argomento"}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* BLOCCO 1 — SINTESI CLASSE */}
            <div className="px-5 py-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Media classe
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {meanScore != null ? `${meanScore}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Completati
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {completedCount}
                    <span className="text-sm font-normal text-muted-foreground"> / {total}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Sotto 50%
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">{belowFifty}</p>
                </div>
              </div>

              {meanScore != null && (
                <div className="rounded-lg bg-card border border-border/60 p-3">
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {readingLine(meanScore)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* BLOCCO 2 — LISTA STUDENTI */}
            {sorted.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Nessuno studente iscritto.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {sorted.map((s) => {
                  const score = typeof s.topicScore === "number" ? Math.round(s.topicScore) : null;
                  const scoreColor =
                    score == null
                      ? "text-muted-foreground"
                      : score < 50
                        ? "text-red-600"
                        : score <= 70
                          ? "text-amber-600"
                          : "text-emerald-600";
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/studente/${s.id}?classId=${classId}`);
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                    >
                      <AvatarInitials name={formatName(s.name)} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {formatName(s.name)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {s.topicCompleted ? "✅ Completato" : "🕐 In attesa"}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreColor}`}>
                        {score != null ? `${score}%` : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── Checkin mode — classification 🔴🟡🟢 ───────────────────
  const categoryOf = (s: Student): Category => s.category || "norma";
  const counts = students.reduce(
    (acc, s) => {
      const c = categoryOf(s);
      if (c === "attenzione") acc.attenzione++;
      else if (c === "occhio") acc.occhio++;
      else acc.norma++;
      return acc;
    },
    { attenzione: 0, occhio: 0, norma: 0 },
  );

  const order: Record<Category, number> = { attenzione: 0, occhio: 1, norma: 2 };
  const sortedCheckin = [...students].sort((a, b) => {
    const da = order[categoryOf(a)];
    const db = order[categoryOf(b)];
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });

  const dotClass = (c: Category) =>
    c === "attenzione"
      ? "bg-red-500"
      : c === "occhio"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const summaryLine = (c: Category) =>
    c === "attenzione"
      ? "Risultati in calo e attività non completate — contatto diretto consigliato."
      : c === "occhio"
        ? "Un segnale da monitorare — tieni d'occhio nelle prossime sessioni."
        : "Sta procedendo regolarmente.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <SheetTitle>Check-in classe ({students.length})</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nessuno studente iscritto.</p>
            </div>
          ) : (
            <>
              {/* BLOCCO 1 — RIEPILOGO */}
              <div className="px-5 py-4 space-y-2 bg-muted/30">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <p className="text-xl font-bold text-foreground">{counts.attenzione}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                      Attenzione
                    </p>
                  </div>
                  <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <p className="text-xl font-bold text-foreground">{counts.occhio}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                      Da tenere d'occhio
                    </p>
                  </div>
                  <div className="rounded-lg bg-card border border-border/60 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <p className="text-xl font-bold text-foreground">{counts.norma}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                      Nella norma
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* BLOCCO 2 — LISTA STUDENTI CLASSIFICATI */}
              <div className="divide-y divide-border/60">
                {sortedCheckin.map((s) => {
                  const cat = categoryOf(s);
                  const isAttenzione = cat === "attenzione";
                  return (
                    <div key={s.id} className="px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/studente/${s.id}?classId=${classId}`);
                        }}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        <AvatarInitials name={formatName(s.name)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass(cat)}`} />
                            <p className="text-sm font-medium text-foreground truncate">
                              {formatName(s.name)}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                            {summaryLine(cat)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      </button>

                      {isAttenzione && (
                        <div className="mt-2.5 ml-11 flex flex-wrap gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChange(false);
                              navigate(`/studente/${s.id}?classId=${classId}`);
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            Apri profilo
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChange(false);
                              navigate(`/classe/${classId}/materiali?create=true`, {
                                state: {
                                  prefilledMaterial: {
                                    tipo: "recupero",
                                    studente_id: s.id,
                                    studente_nome: s.name,
                                  },
                                },
                              });
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                          >
                            Genera recupero
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* BLOCCO 3 — NOTA */}
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20">
                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                  Questo quadro è una sintesi degli ultimi 7 giorni — non una valutazione permanente.
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
