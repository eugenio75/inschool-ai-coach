import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export function CoachPresence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<{ text: string; route: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachInput, setCoachInput] = useState("");

  useEffect(() => {
    const cached = sessionStorage.getItem("inschool-coach-presence");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessage(parsed.message);
        setAction(parsed.action || null);
        setLoading(false);
        return;
      } catch {}
    }
    fetchCoachMessage();
  }, []);

  async function fetchCoachMessage() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const profileId = getChildSession()?.profileId || profile?.id;

      const [homeworkRes, sessionsRes] = await Promise.all([
        supabase.from("homework_tasks").select("title, subject, due_date, completed")
          .eq("child_profile_id", profileId).eq("completed", false).order("due_date", { ascending: true }).limit(3),
        supabase.from("guided_sessions").select("homework_id, completed_at, bloom_level_reached")
          .eq("user_id", user?.id || profileId).eq("status", "completed").order("completed_at", { ascending: false }).limit(1),
      ]);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-home-message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            userName: profile?.name || "Studente",
            schoolLevel: profile?.school_level || "superiori",
            lastSession: sessionsRes.data?.[0] || null,
            pendingHomework: homeworkRes.data || [],
            emotionalHistory: null,
            upcomingTests: null,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setMessage(data.message);
        if (data.suggestedAction && data.actionRoute) {
          setAction({ text: data.suggestedAction, route: data.actionRoute });
        }
        sessionStorage.setItem("inschool-coach-presence", JSON.stringify({
          message: data.message,
          action: data.suggestedAction ? { text: data.suggestedAction, route: data.actionRoute } : null,
        }));
      }
    } catch (err) {
      console.error("CoachPresence error:", err);
    }
    setLoading(false);
  }

  const handleSend = () => {
    if (!coachInput.trim()) return;
    navigate(`/challenge/new?msg=${encodeURIComponent(coachInput)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      {/* Coach message */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed font-medium">
              {message || "Ciao! Come posso aiutarti oggi?"}
            </p>
          )}
          {action && !loading && (
            <button
              onClick={() => navigate(action.route)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {action.text}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Input + quick actions */}
      <div className="border-t border-border pt-4">
        <p className="font-semibold text-foreground text-sm mb-1">Hai bisogno di aiuto?</p>
        <p className="text-xs text-muted-foreground mb-3">
          Chiedi al coach di spiegarti un concetto, organizzare lo studio o prepararti per una verifica.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={coachInput}
            onChange={(e) => setCoachInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Scrivi al coach..."
            className="flex-1 text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/50"
          />
          <button
            onClick={handleSend}
            disabled={!coachInput.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: "Spiegami un argomento", prompt: "spiegami" },
            { label: "Aiutami a studiare", prompt: "aiuto-studio" },
            { label: "Non ho capito un esercizio", prompt: "esercizio" },
          ].map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => navigate(`/challenge/new?prompt=${prompt}`)}
              className="text-xs border border-border hover:border-primary hover:text-primary text-muted-foreground px-3 py-1.5 rounded-lg transition-colors bg-card"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
