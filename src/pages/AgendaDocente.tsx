import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, BookOpen, FileText, Users, Trash2, X, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/BackLink";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, addWeeks } from "date-fns";
import { it } from "date-fns/locale";

type ViewMode = "giorno" | "settimana" | "mese";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "assignment" | "verifica" | "nota" | "ricevimento" | "riunione";
  severity?: "normal" | "urgent" | "overdue";
  className?: string;
  classId?: string;
  subject?: string;
  time?: string;
  description?: string;
  source: "assignment" | "calendar";
}

const typeColors: Record<string, string> = {
  verifica: "bg-purple-100 text-purple-700 border-purple-200",
  assignment: "bg-blue-100 text-blue-700 border-blue-200",
  nota: "bg-slate-100 text-slate-700 border-slate-200",
  ricevimento: "bg-emerald-100 text-emerald-700 border-emerald-200",
  riunione: "bg-amber-100 text-amber-700 border-amber-200",
};

const typeLabels: Record<string, string> = {
  verifica: "Verifica",
  assignment: "Compito",
  nota: "Nota",
  ricevimento: "Ricevimento",
  riunione: "Riunione",
};

const dotColors: Record<string, string> = {
  verifica: "bg-purple-500",
  assignment: "bg-blue-500",
  nota: "bg-slate-400",
  ricevimento: "bg-emerald-500",
  riunione: "bg-amber-500",
};

export default function AgendaDocente() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const teacherId = user?.id;

  const [viewMode, setViewMode] = useState<ViewMode>("settimana");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [classi, setClassi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // New event form
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", event_type: "nota",
    event_date: "", event_time: "", class_id: "", duration_minutes: 60,
  });

  useEffect(() => {
    if (!teacherId) {
      // Still loading auth — don't set loading false yet unless auth is settled
      return;
    }
    loadData();
  }, [teacherId]);

  async function loadData() {
    setLoading(true);
    const profileId = session?.profileId;

    if (!teacherId) {
      return;
    }

    const [assignRes, calRes, classiRes] = await Promise.all([
      supabase.from("teacher_assignments").select("*").eq("teacher_id", teacherId).order("due_date", { ascending: true }),
      (supabase as any).from("teacher_calendar_events").select("*").eq("teacher_id", teacherId).order("event_date", { ascending: true }),
      profileId
        ? (supabase as any).from("classi").select("id, nome, materia").eq("docente_profile_id", profileId)
        : Promise.resolve({ data: [] }),
    ]);

    setAssignments(assignRes.data || []);
    setCalendarEvents(calRes.data || []);
    setClassi(classiRes.data || []);
    setLoading(false);
  }

  // Merge all events
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    const classMap = Object.fromEntries(classi.map((c: any) => [c.id, c]));

    for (const a of assignments) {
      if (!a.due_date) continue;
      const dueDate = new Date(a.due_date);
      const now = new Date();
      const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      events.push({
        id: a.id,
        title: a.title,
        date: dueDate,
        type: a.type === "verifica" ? "verifica" : "assignment",
        severity: daysLeft < 0 ? "overdue" : daysLeft <= 2 ? "urgent" : "normal",
        className: classMap[a.class_id]?.nome,
        classId: a.class_id,
        subject: a.subject,
        description: a.description,
        source: "assignment",
      });
    }

    for (const ce of calendarEvents) {
      events.push({
        id: ce.id,
        title: ce.title,
        date: new Date(ce.event_date),
        type: ce.event_type || "nota",
        className: classMap[ce.class_id]?.nome,
        classId: ce.class_id,
        time: ce.event_time?.slice(0, 5),
        description: ce.description,
        source: "calendar",
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assignments, calendarEvents, classi]);

  // Navigation
  const goNext = () => {
    if (viewMode === "giorno") setCurrentDate(d => addDays(d, 1));
    else if (viewMode === "settimana") setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };
  const goPrev = () => {
    if (viewMode === "giorno") setCurrentDate(d => addDays(d, -1));
    else if (viewMode === "settimana") setCurrentDate(d => addWeeks(d, -1));
    else setCurrentDate(d => addMonths(d, -1));
  };
  const goToday = () => setCurrentDate(new Date());

  // Get days for current view
  const viewDays = useMemo(() => {
    if (viewMode === "giorno") return [currentDate];
    if (viewMode === "settimana") {
      const start = startOfWeek(currentDate, { locale: it });
      return eachDayOfInterval({ start, end: endOfWeek(currentDate, { locale: it }) });
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthStart = startOfWeek(start, { locale: it });
    const monthEnd = endOfWeek(end, { locale: it });
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentDate, viewMode]);

  const eventsForDay = (day: Date) => allEvents.filter(e => isSameDay(e.date, day));

  async function createEvent() {
    if (!newEvent.title.trim() || !newEvent.event_date) {
      toast.error("Inserisci titolo e data");
      return;
    }
    if (!teacherId) {
      toast.error("Sessione docente non disponibile");
      return;
    }
    const { error } = await (supabase as any).from("teacher_calendar_events").insert({
      teacher_id: teacherId,
      title: newEvent.title,
      description: newEvent.description || null,
      event_type: newEvent.event_type,
      event_date: newEvent.event_date,
      event_time: newEvent.event_time || null,
      class_id: newEvent.class_id || null,
      duration_minutes: newEvent.duration_minutes || null,
    });
    if (error) { toast.error("Errore nel salvataggio"); return; }
    toast.success("Evento aggiunto!");
    setShowNewEvent(false);
    setNewEvent({ title: "", description: "", event_type: "nota", event_date: "", event_time: "", class_id: "", duration_minutes: 60 });
    loadData();
  }

  async function deleteEvent(id: string) {
    await (supabase as any).from("teacher_calendar_events").delete().eq("id", id);
    toast.success("Evento eliminato");
    loadData();
  }

  const headerTitle = useMemo(() => {
    if (viewMode === "giorno") return format(currentDate, "EEEE d MMMM yyyy", { locale: it });
    if (viewMode === "settimana") {
      const start = startOfWeek(currentDate, { locale: it });
      const end = endOfWeek(currentDate, { locale: it });
      return `${format(start, "d", { locale: it })} – ${format(end, "d MMMM yyyy", { locale: it })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: it });
  }, [currentDate, viewMode]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="relative">
      <BackLink label="alla home" to="/dashboard" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" /> Agenda
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{headerTitle}</p>
          </div>
        </div>
        <Button size="sm" className="rounded-xl bg-[#0070C0] hover:bg-[#005fa3]" onClick={() => {
          setNewEvent(e => ({ ...e, event_date: format(selectedDate || new Date(), "yyyy-MM-dd") }));
          setShowNewEvent(true);
        }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo evento
        </Button>
      </div>

      {/* View controls */}
      <div className="flex items-center justify-between mb-4 bg-white border border-slate-200 rounded-xl p-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goPrev} className="rounded-lg h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="rounded-lg text-xs h-8">
            Oggi
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext} className="rounded-lg h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-1">
          {(["giorno", "settimana", "mese"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                viewMode === v ? "bg-[#1A3A5C] text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === "mese" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {viewDays.map((day, i) => {
              const dayEvents = eventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedDate(day); setCurrentDate(day); setViewMode("giorno"); }}
                  className={`min-h-[80px] p-1.5 border-r border-b border-slate-50 text-left transition-colors hover:bg-slate-50 ${
                    !inMonth ? "opacity-40" : ""
                  } ${isToday(day) ? "bg-blue-50/50" : ""}`}
                >
                  <span className={`text-xs font-medium block mb-1 ${
                    isToday(day) ? "bg-[#0070C0] text-white w-5 h-5 rounded-full flex items-center justify-center" : "text-slate-600"
                  }`}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[e.type] || "bg-slate-400"}`} />
                        <span className="text-[10px] text-slate-600 truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-slate-400">+{dayEvents.length - 3} altri</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : viewMode === "settimana" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-100">
            {viewDays.map((day, i) => {
              const dayEvents = eventsForDay(day);
              return (
                <div key={i} className={`min-h-[300px] ${isToday(day) ? "bg-blue-50/30" : ""}`}>
                  <div className={`text-center py-2 border-b border-slate-100 ${isToday(day) ? "bg-[#0070C0]/5" : ""}`}>
                    <p className="text-[10px] uppercase text-slate-400">{format(day, "EEE", { locale: it })}</p>
                    <p className={`text-sm font-semibold ${
                      isToday(day) ? "bg-[#0070C0] text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto" : "text-slate-700"
                    }`}>
                      {day.getDate()}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {dayEvents.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setSelectedDate(day); setCurrentDate(day); setViewMode("giorno"); }}
                        className={`w-full text-left p-1.5 rounded-md border text-[11px] leading-tight transition-colors hover:shadow-sm ${typeColors[e.type] || typeColors.nota}`}
                      >
                        {e.time && <span className="font-semibold">{e.time} </span>}
                        <span className="font-medium">{e.title}</span>
                        {e.className && <span className="block text-[10px] opacity-70 mt-0.5">{e.className}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day view */
        <div className="space-y-3">
          {eventsForDay(currentDate).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-1">Nessun impegno per {format(currentDate, "EEEE d MMMM", { locale: it })}</p>
              <Button variant="outline" size="sm" className="rounded-xl mt-3" onClick={() => {
                setNewEvent(e => ({ ...e, event_date: format(currentDate, "yyyy-MM-dd") }));
                setShowNewEvent(true);
              }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi evento
              </Button>
            </div>
          ) : (
            eventsForDay(currentDate).map(e => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border rounded-xl p-4 flex items-start gap-4 hover:shadow-sm transition-shadow ${
                  e.severity === "overdue" ? "border-red-200 bg-red-50/30" :
                  e.severity === "urgent" ? "border-amber-200 bg-amber-50/30" : "border-slate-200"
                }`}
              >
                {/* Time column */}
                <div className="w-14 shrink-0 text-center">
                  {e.time ? (
                    <p className="text-sm font-bold text-slate-700">{e.time}</p>
                  ) : (
                    <Clock className="w-4 h-4 text-slate-300 mx-auto" />
                  )}
                </div>

                {/* Dot */}
                <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${dotColors[e.type] || "bg-slate-400"}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm">{e.title}</p>
                    <Badge variant="outline" className={`text-[10px] capitalize ${typeColors[e.type]}`}>
                      {typeLabels[e.type] || e.type}
                    </Badge>
                    {e.severity === "overdue" && <Badge className="bg-red-500 text-white text-[10px]">Scaduto</Badge>}
                    {e.severity === "urgent" && <Badge className="bg-amber-500 text-white text-[10px]">Urgente</Badge>}
                  </div>
                  {e.className && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {e.className}
                      {e.subject && <span>· {e.subject}</span>}
                    </p>
                  )}
                  {e.description && <p className="text-xs text-slate-500 mt-1">{e.description}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {e.classId && (
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs h-7" onClick={() => navigate(`/classe/${e.classId}`)}>
                      Vai
                    </Button>
                  )}
                  {e.source === "calendar" && (
                    <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteEvent(e.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {Object.entries(typeLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColors[key]}`} />
            {label}
          </div>
        ))}
      </div>

      {/* New event dialog */}
      <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader><DialogTitle>Nuovo evento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Titolo *</Label>
              <Input placeholder="es. Colloquio genitori, Consiglio di classe..." value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={newEvent.event_date}
                  onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Ora</Label>
                <Input type="time" value={newEvent.event_time}
                  onChange={e => setNewEvent(p => ({ ...p, event_time: e.target.value }))} className="mt-1 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newEvent.event_type} onValueChange={v => setNewEvent(p => ({ ...p, event_type: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota">Nota personale</SelectItem>
                    <SelectItem value="ricevimento">Ricevimento</SelectItem>
                    <SelectItem value="riunione">Riunione</SelectItem>
                    <SelectItem value="verifica">Verifica</SelectItem>
                    <SelectItem value="assignment">Compito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Classe</Label>
                <Select value={newEvent.class_id || "none"} onValueChange={v => setNewEvent(p => ({ ...p, class_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna</SelectItem>
                    {classi.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} — {c.materia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea placeholder="Dettagli opzionali..." value={newEvent.description}
                onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} className="mt-1 rounded-xl min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEvent(false)} className="rounded-xl">Annulla</Button>
            <Button onClick={createEvent} className="rounded-xl bg-[#0070C0] hover:bg-[#005fa3]">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
