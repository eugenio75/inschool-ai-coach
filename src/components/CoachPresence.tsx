import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ArrowRight, Loader2 } from "lucide-react";
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

  useEffect(() => {
    // Check sessionStorage first to avoid re-calling
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

      // Gather context
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
        // Cache
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

  if (loading) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 mb-6 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-navy)] flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
            {message}
          </p>
          {action && (
            <button
              onClick={() => navigate(action.route)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              {action.text}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
