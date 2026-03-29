import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sun, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface DailySummaryCardProps {
  childProfileId: string;
  childName: string;
}

export const DailySummaryCard = ({ childProfileId, childName }: DailySummaryCardProps) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [hasAttention, setHasAttention] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      <div className="flex items-center justify-between mb-3">
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
          <h3 className="font-display font-semibold text-foreground text-sm">
            La giornata di {childName} — oggi
          </h3>
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

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-4/5 rounded-lg" />
          <Skeleton className="h-4 w-3/5 rounded-lg" />
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
    </motion.div>
  );
};
