import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, BookOpen, FileText, Brain, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession, isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

interface AgendaItem {
  id: string;
  type: "homework" | "assignment" | "review";
  title: string;
  subject: string;
  date: string;
  completed: boolean;
  route: string;
}

export default function Agenda() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const profileId = getChildSession()?.profileId || profile?.id;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [view, setView] = useState<"day" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (!profileId) return;
    loadAgenda();
  }, [profileId, currentDate, view]);

  async function loadAgenda() {
    setLoading(true);
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    const [hwRes, assignRes, flashRes] = await Promise.all([
      supabase.from("homework_tasks").select("id, title, subject, due_date, completed")
        .eq("child_profile_id", profileId)
        .gte("due_date", startStr).lte("due_date", endStr)
        .order("due_date"),
      supabase.from("teacher_assignments").select("id, title, subject, due_date, type")
        .eq("student_id", user?.id || "").gte("due_date", start.toISOString()).lte("due_date", end.toISOString()),
      supabase.from("flashcards").select("id, subject, next_review_at")
        .eq("user_id", user?.id || profileId || "").not("next_review_at", "is", null)
        .gte("next_review_at", start.toISOString()).lte("next_review_at", end.toISOString()),
    ]);

    const agendaItems: AgendaItem[] = [];

    for (const hw of (hwRes.data || [])) {
      agendaItems.push({
        id: hw.id, type: "homework", title: hw.title, subject: hw.subject,
        date: hw.due_date || startStr, completed: hw.completed || false,
        route: `/homework/${hw.id}`,
      });
    }

    for (const a of (assignRes.data || [])) {
      agendaItems.push({
        id: a.id, type: "assignment", title: a.title, subject: a.subject || "",
        date: a.due_date?.split("T")[0] || startStr, completed: false,
        route: `/us?type=guided&hw=${a.id}`,
      });
    }

    for (const f of (flashRes.data || [])) {
      agendaItems.push({
        id: f.id, type: "review", title: t('agenda_review', { subject: f.subject }), subject: f.subject,
        date: f.next_review_at?.split("T")[0] || startStr, completed: false,
        route: "/memory",
      });
    }

    agendaItems.sort((a, b) => a.date.localeCompare(b.date));
    setItems(agendaItems);
    setLoading(false);
  }

  function navigate_date(dir: number) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (view === "day" ? dir : dir * 7));
    setCurrentDate(d);
  }

  const typeIcons = { homework: BookOpen, assignment: FileText, review: Brain };
  const typeColors = { homework: "bg-blue-100 text-blue-700", assignment: "bg-orange-100 text-orange-700", review: "bg-purple-100 text-purple-700" };
  const typeLabels = { homework: "Compito", assignment: "Dal professore", review: "Ripasso" };

  // Group by date for week view
  const grouped: Record<string, AgendaItem[]> = {};
  for (const item of items) {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  }

  const dateLabel = view === "day"
    ? currentDate.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
    : (() => {
        const start = new Date(currentDate);
        const day = start.getDay();
        start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${start.getDate()} - ${end.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`;
      })();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <CalendarDays className="w-5 h-5 text-slate-600" />
        <h1 className="font-display text-lg font-bold text-slate-900">Agenda</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate_date(-1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 capitalize min-w-[180px] text-center">{dateLabel}</span>
            <button onClick={() => navigate_date(1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setView("day")} className={`px-3 py-1.5 text-xs font-medium ${view === "day" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Giorno</button>
            <button onClick={() => setView("week")} className={`px-3 py-1.5 text-xs font-medium ${view === "week" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Settimana</button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-500 mb-1">Nessuna attività in programma</p>
            <p className="text-sm text-slate-400">Aggiungi compiti per vederli qui nell'agenda</p>
          </div>
        ) : view === "day" ? (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(item.route)}
                  className={`bg-white border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-all ${item.completed ? "opacity-60" : ""}`}
                >
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.completed ? "line-through text-slate-400" : "text-slate-900"}`}>{item.title}</p>
                    <p className="text-xs text-slate-400">{item.subject}</p>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${typeColors[item.type]}`}>{typeLabels[item.type]}</Badge>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dateItems]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {new Date(date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" })}
                </p>
                <div className="space-y-2">
                  {dateItems.map(item => {
                    const Icon = typeIcons[item.type];
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigate(item.route)}
                        className={`bg-white border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-all ${item.completed ? "opacity-60" : ""}`}
                      >
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${item.completed ? "line-through text-slate-400" : "text-slate-900"}`}>{item.title}</p>
                          <p className="text-xs text-slate-400">{item.subject}</p>
                        </div>
                        <Badge variant="secondary" className={`text-xs ${typeColors[item.type]}`}>{typeLabels[item.type]}</Badge>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
