import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Lightbulb, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
}

interface SummaryData {
  summary: string;
  suggestions: string[];
}

export default function LearningIndexModal({ open, onOpenChange, classId }: Props) {
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
        setData({ summary: j.summary || "", suggestions: j.suggestions || [] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, classId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Come sta andando la classe
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

        {!loading && data && (
          <div className="space-y-4 py-2">
            <section className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Sintesi
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {data.summary}
              </p>
            </section>

            {data.suggestions.length > 0 && (
              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Cosa puoi fare
                  </p>
                </div>
                <ul className="space-y-2">
                  {data.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
