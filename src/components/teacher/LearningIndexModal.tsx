import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, GraduationCap, Heart, AlertCircle, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
}

interface Cta {
  label: string;
  action: string;
  params?: Record<string, any>;
}

interface Card {
  titolo: string;
  testo: string;
  cta_primaria: Cta | null;
  cta_secondaria: Cta | null;
}

interface SummaryData {
  summary: string;
  suggestions: string[];
  card1?: Card;
  card2?: Card;
  card3?: Card;
  card4?: Card;
}

interface StudentRow {
  parent_id: string;
  nome: string;
  categoria: "nella_norma" | "da_tenere_docchio" | "attenzione";
  sintesi: string;
  argomenti_fragili: string[];
  azione_suggerita: string | null;
  cta_primaria?: Cta | null;
  cta_secondaria?: Cta | null;
}

interface CheckinData {
  generato_il: string;
  periodo: string;
  classe: string;
  riepilogo: { nella_norma: number; da_tenere_docchio: number; attenzione: number };
  studenti: StudentRow[];
  nota: string;
}

const CARD_ICONS = [BookOpen, GraduationCap, Heart, AlertCircle];

export default function LearningIndexModal({ open, onOpenChange, classId }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<SummaryData | null>(null);
  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [error, setError] = useState("");
  const [errorCheckin, setErrorCheckin] = useState("");
  const [tab, setTab] = useState<"classe" | "studenti">("classe");

  async function authedFetch(fnName: string) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ classId }),
      },
    );
  }

  useEffect(() => {
    if (!open) return;
    setData(null);
    setCheckin(null);
    setError("");
    setErrorCheckin("");
    setTab("classe");
    setLoading(true);
    (async () => {
      try {
        const res = await authedFetch("class-learning-summary");
        if (!res.ok) throw new Error("Errore nel caricamento");
        const j = await res.json();
        setData(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  // Lazy-load Studenti tab on first open
  useEffect(() => {
    if (!open || tab !== "studenti" || checkin || loadingCheckin) return;
    setLoadingCheckin(true);
    setErrorCheckin("");
    (async () => {
      try {
        const res = await authedFetch("class-checkin-summary");
        if (!res.ok) throw new Error("Errore nel caricamento check-in");
        const j = await res.json();
        setCheckin(j);
      } catch (e) {
        setErrorCheckin(e instanceof Error ? e.message : "Errore");
      } finally {
        setLoadingCheckin(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  function handleCta(cta: Cta) {
    const p = cta.params || {};
    onOpenChange(false);
    switch (cta.action) {
      case "open_materiali": {
        const qs = new URLSearchParams();
        qs.set("create", "true");
        if (p.tipo) qs.set("tipo", String(p.tipo));
        if (p.argomento) qs.set("argomento", String(p.argomento));
        if (p.studente_id) qs.set("studente_id", String(p.studente_id));
        navigate(`/classe/${p.classe_id || classId}/materiali?${qs.toString()}`);
        break;
      }
      case "open_coach_docente": {
        const qs = new URLSearchParams();
        if (p.prompt_precaricato) qs.set("prompt", String(p.prompt_precaricato));
        if (p.classe_id) qs.set("classe_id", String(p.classe_id));
        navigate(`/coach-docente${qs.toString() ? `?${qs.toString()}` : ""}`);
        break;
      }
      case "open_classe_quadro": {
        const qs = new URLSearchParams();
        if (p.sezione) qs.set("sezione", String(p.sezione));
        if (p.filtro_argomento) qs.set("argomento", String(p.filtro_argomento));
        navigate(`/classe/${p.classe_id || classId}/quadro${qs.toString() ? `?${qs.toString()}` : ""}`);
        break;
      }
      case "open_studente": {
        const qs = new URLSearchParams();
        if (p.classe_id) qs.set("classId", String(p.classe_id));
        navigate(`/studente/${p.studente_id}${qs.toString() ? `?${qs.toString()}` : ""}`);
        break;
      }
      case "open_checkin": {
        navigate(`/classe/${p.classe_id || classId}/quadro?sezione=clima`);
        break;
      }
      default:
        console.warn("Azione CTA sconosciuta:", cta.action);
    }
  }

  const cards: Card[] = data
    ? ([data.card1, data.card2, data.card3, data.card4].filter(Boolean) as Card[])
    : [];

  const categoryStyle: Record<StudentRow["categoria"], { dot: string; label: string; bg: string }> = {
    attenzione: { dot: "bg-destructive", label: "Attenzione", bg: "bg-destructive/5 border-destructive/30" },
    da_tenere_docchio: { dot: "bg-amber-500", label: "Da tenere d'occhio", bg: "bg-amber-500/5 border-amber-500/30" },
    nella_norma: { dot: "bg-emerald-500", label: "Nella norma", bg: "bg-emerald-500/5 border-emerald-500/30" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Approfondisci la classe
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "classe" | "studenti")} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="classe" className="gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Classe
            </TabsTrigger>
            <TabsTrigger value="studenti" className="gap-2">
              <Users className="w-3.5 h-3.5" /> Studenti
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classe" className="mt-4">
            {loading && (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Il Coach AI sta riflettendo…</p>
              </div>
            )}

            {error && (
              <div className="py-6 text-sm text-destructive text-center">{error}</div>
            )}

            {!loading && data && cards.length > 0 && (
              <div className="space-y-3">
                {cards.map((c, i) => {
                  const Icon = CARD_ICONS[i] || BookOpen;
                  return (
                    <section
                      key={i}
                      className="rounded-xl border border-border bg-card p-4 shadow-soft"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="rounded-lg bg-primary/10 p-1.5">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{c.titolo}</h3>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {c.testo}
                      </p>
                      {(c.cta_primaria || c.cta_secondaria) && (
                        <div className="flex flex-wrap gap-2">
                          {c.cta_primaria && (
                            <Button
                              size="sm"
                              onClick={() => handleCta(c.cta_primaria!)}
                              className="rounded-full"
                            >
                              {c.cta_primaria.label}
                            </Button>
                          )}
                          {c.cta_secondaria && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCta(c.cta_secondaria!)}
                              className="rounded-full"
                            >
                              {c.cta_secondaria.label}
                            </Button>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {!loading && data && cards.length === 0 && (
              <section className="rounded-xl bg-muted/40 border border-border p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {data.summary}
                </p>
              </section>
            )}
          </TabsContent>

          <TabsContent value="studenti" className="mt-4">
            {loadingCheckin && (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Sto leggendo i segnali degli ultimi 7 giorni…</p>
              </div>
            )}

            {errorCheckin && (
              <div className="py-6 text-sm text-destructive text-center">{errorCheckin}</div>
            )}

            {!loadingCheckin && checkin && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                    <div className="text-2xl font-semibold text-foreground">{checkin.riepilogo.nella_norma}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">🟢 Nella norma</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                    <div className="text-2xl font-semibold text-foreground">{checkin.riepilogo.da_tenere_docchio}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">🟡 Da tenere d'occhio</div>
                  </div>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center">
                    <div className="text-2xl font-semibold text-foreground">{checkin.riepilogo.attenzione}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">🔴 Attenzione</div>
                  </div>
                </div>

                {checkin.studenti.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Nessuno studente da mostrare. Verifica iscrizioni e consensi.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checkin.studenti.map((s) => {
                      const style = categoryStyle[s.categoria];
                      return (
                        <section
                          key={s.parent_id}
                          className={`rounded-xl border p-3 ${style.bg}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-foreground truncate">{s.nome}</h4>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                                  {style.label}
                                </span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{s.sintesi}</p>
                              {s.argomenti_fragili.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {s.argomenti_fragili.map((t) => (
                                    <span
                                      key={t}
                                      className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {s.categoria === "attenzione" && (s.cta_primaria || s.cta_secondaria) && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {s.cta_primaria && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCta(s.cta_primaria!)}
                                      className="rounded-full h-8 text-xs"
                                    >
                                      {s.cta_primaria.label}
                                    </Button>
                                  )}
                                  {s.cta_secondaria && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCta(s.cta_secondaria!)}
                                      className="rounded-full h-8 text-xs"
                                    >
                                      {s.cta_secondaria.label}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground italic text-center pt-1">
                  {checkin.nota}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
