import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, GraduationCap, Heart, AlertCircle, Sparkles } from "lucide-react";
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

const CARD_ICONS = [BookOpen, GraduationCap, Heart, AlertCircle];

export default function LearningIndexModal({ open, onOpenChange, classId }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError("");
    setLoading(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-learning-summary`,
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
        if (!res.ok) throw new Error("Errore nel caricamento");
        const j = await res.json();
        setData(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, classId]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Quadro della classe
          </DialogTitle>
        </DialogHeader>

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
          <div className="space-y-3 py-2">
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
          <div className="space-y-4 py-2">
            <section className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {data.summary}
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
