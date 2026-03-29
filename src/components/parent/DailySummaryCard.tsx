import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sun, RefreshCw, AlertCircle, Clock, BookOpen, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface DailySummaryCardProps {
  childProfileId: string;
  childName: string;
  missions: any[];
}

export const DailySummaryCard = ({ childProfileId, childName, missions }: DailySummaryCardProps) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [hasAttention, setHasAttention] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState<{
    study_minutes: number;
    total_sessions: number;
    completed_tasks: number;
  }>({ study_minutes: 0, total_sessions: 0, completed_tasks: 0 });

  const today = new Date().toISOString().split("T")[0];
  const todayMissions = missions.filter(m => m.mission_date === today);
  const completedMissions = todayMissions.filter(m => m.completed);

  const fetchSummary = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(false);

      const { data, error: fnError } = await supabase.functions.invoke("daily-child-summary", {
        body: { child_profile_id: childProfileId, force_refresh: forceRefresh },
      });

      if (fnError) throw fnError;
      setSummary(data?.summary || null);
      setHasAttention(data?.has_attention_signal || false);
      if (data?.today_stats) {
        setTodayStats({
          study_minutes: data.today_stats.study_minutes || 0,
          total_sessions: data.today_stats.total_sessions || 0,
          completed_tasks: data.today_stats.completed_tasks || 0,
        });
      }
    } catch (e) {
      console.error("Failed to fetch daily summary:", e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [childProfileId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.1 }}
      className={`bg-card rounded-2xl border p-5 shadow-soft ${
        hasAttention ? "border-amber-300 dark:border-amber-700" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            hasAttention ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"
          }`}>
            {hasAttention ? (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            ) : (
              <Sun className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">
              La giornata di {childName} — oggi
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchSummary(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
          title="Aggiorna"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/50 rounded-xl p-3 text-center">
          <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-bold text-foreground text-sm">{todayStats.study_minutes}m</p>
          <p className="text-[10px] text-muted-foreground">Studio</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 text-center">
          <BookOpen className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-bold text-foreground text-sm">{todayStats.total_sessions}</p>
          <p className="text-[10px] text-muted-foreground">Sessioni</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 text-center">
          <CheckCircle2 className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-bold text-foreground text-sm">{todayStats.completed_tasks}</p>
          <p className="text-[10px] text-muted-foreground">Completati</p>
        </div>
      </div>

      {/* Missions progress */}
      {todayMissions.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-3 mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Missioni: {completedMissions.length}/{todayMissions.length}
          </p>
          <div className="flex gap-1">
            {todayMissions.map((_m: any, i: number) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${todayMissions[i]?.completed ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider + AI narrative */}
      <div className="border-t border-border pt-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-4/5 rounded-lg" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Il riassunto di oggi non è disponibile al momento. Riprova tra poco.
          </p>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed">
            {summary}
          </p>
        )}
      </div>
    </motion.div>
  );
};
