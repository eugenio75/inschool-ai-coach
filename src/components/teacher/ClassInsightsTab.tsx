import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart2, AlertTriangle, BookOpen, Heart, Loader2, Users,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ClassInsightsProps {
  classId: string;
  onGenerateRecovery?: (subject: string, topic: string, count: number) => void;
}

interface InsightsData {
  formatDistribution: Record<string, Record<string, number>>;
  frustrationAlerts: Array<{
    studentName: string;
    subject: string;
    hesitationScore: number;
    avgHints: number;
    consecutiveBad: number;
  }>;
  hardTopics: Array<{
    topic: string;
    affectedStudents: number;
    percentage: number;
  }>;
  moodAtRisk: Array<{
    studentName: string;
    moodStreak: number;
    recentTone: string;
  }>;
  totalStudents: number;
}

const FORMAT_LABELS: Record<string, string> = {
  logico: "Logico-strutturale",
  narrativo: "Narrativo",
  analogico: "Dialogico",
  visivo: "Visivo-pratico",
  "non definito": "Non ancora rilevato",
};

const FORMAT_COLORS: Record<string, string> = {
  logico: "bg-primary",
  narrativo: "bg-accent",
  analogico: "bg-secondary",
  visivo: "bg-muted-foreground",
  "non definito": "bg-muted",
};

export default function ClassInsightsTab({ classId, onGenerateRecovery }: ClassInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInsights();
  }, [classId]);

  async function fetchInsights() {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-class-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ classId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nel caricamento");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data || data.totalStudents === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-medium text-foreground mb-1">Nessun dato disponibile</p>
        <p className="text-sm text-muted-foreground">
          Gli insights appariranno quando gli studenti inizieranno a studiare con SarAI.
        </p>
      </div>
    );
  }

  const hasAlerts = data.frustrationAlerts.length > 0 || data.moodAtRisk.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Format Distribution ── */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Stili di apprendimento osservati
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Distribuzione degli stili prevalenti tra gli studenti, calcolata dal comportamento reale nelle sessioni.
        </p>

        {Object.entries(data.formatDistribution).map(([subject, styles]) => {
          const total = Object.values(styles).reduce((a, b) => a + b, 0);
          if (total === 0) return null;
          return (
            <div key={subject} className="mb-4 last:mb-0">
              <p className="text-xs font-medium text-foreground capitalize mb-2">{subject}</p>
              <div className="space-y-1.5">
                {Object.entries(styles)
                  .sort(([, a], [, b]) => b - a)
                  .map(([style, count]) => {
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={style} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">
                          {FORMAT_LABELS[style] || style}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${FORMAT_COLORS[style] || "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}

        {Object.keys(data.formatDistribution).length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Non ci sono ancora dati sufficienti per calcolare la distribuzione.
          </p>
        )}
      </section>

      {/* ── Hard Topics ── */}
      {data.hardTopics.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">
              Argomenti critici
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Argomenti con errori non risolti per oltre il 30% della classe.
          </p>
          <div className="space-y-2">
            {data.hardTopics.map((ht, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3"
              >
                <span className="text-sm text-foreground font-medium">{ht.topic}</span>
                <div className="flex items-center gap-2">
                  <Progress value={ht.percentage} className="w-16 h-1.5" />
                  <Badge variant="secondary" className="text-[10px]">
                    {ht.affectedStudents}/{data.totalStudents} ({ht.percentage}%)
                  </Badge>
                  {onGenerateRecovery && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-6 text-[10px] px-2 shrink-0"
                      onClick={() => onGenerateRecovery("", ht.topic, ht.affectedStudents)}
                    >
                      🔧 Genera recupero
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Alerts Section ── */}
      {hasAlerts && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-display font-semibold text-foreground text-sm">
              Segnalazioni
            </h3>
          </div>

          {/* Frustration Alerts */}
          {data.frustrationAlerts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Difficoltà persistente
              </p>
              <div className="space-y-2">
                {data.frustrationAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-destructive/5 border border-destructive/10 rounded-xl px-4 py-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {alert.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alert.subject} — esitazione {Math.round(alert.hesitationScore * 100)}%, media {alert.avgHints} indizi/sessione ({alert.consecutiveBad} sessioni consecutive critiche)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood at Risk */}
          {data.moodAtRisk.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Benessere emotivo
              </p>
              <div className="space-y-2">
                {data.moodAtRisk.map((risk, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-accent/30 border border-accent/20 rounded-xl px-4 py-3"
                  >
                    <Heart className="w-4 h-4 text-accent-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {risk.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mood negativo da {risk.moodStreak} giorni consecutivi
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── No alerts state ── */}
      {!hasAlerts && data.hardTopics.length === 0 && (
        <section className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <BarChart2 className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Nessuna segnalazione</p>
          <p className="text-xs text-muted-foreground">
            La classe procede regolarmente. Non ci sono situazioni che richiedono attenzione immediata.
          </p>
        </section>
      )}

      {/* ── Footer note ── */}
      <p className="text-[10px] text-muted-foreground text-center px-4">
        I dati mostrati includono solo gli studenti per cui è attivo il consenso alla condivisione con il docente.
        I dati sono aggregati a livello di classe. I punteggi individuali non sono visibili. 
        Le segnalazioni di benessere emotivo sono basate su check-in volontari.
      </p>
    </div>
  );
}
