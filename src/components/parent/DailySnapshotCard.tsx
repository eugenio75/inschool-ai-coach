import { motion } from "framer-motion";
import { Calendar, BookOpen, Clock, TrendingUp, CheckCircle2 } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface DailySnapshotCardProps {
  childName: string;
  sessions: any[];
  tasks: any[];
  missions: any[];
}

export const DailySnapshotCard = ({ childName, sessions, tasks, missions }: DailySnapshotCardProps) => {
  const today = new Date().toISOString().split("T")[0];

  const todaySessions = sessions.filter(s => s.completed_at?.startsWith(today));
  const todayMinutes = todaySessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);
  const todayTasks = tasks.filter(t => t.completed && t.updated_at?.startsWith(today));
  const todayMissions = missions.filter(m => m.mission_date === today);
  const completedMissions = todayMissions.filter(m => m.completed);

  const lastEmotion = todaySessions.length > 0 
    ? todaySessions[todaySessions.length - 1]?.emotion 
    : null;

  const emotionLabels: Record<string, string> = {
    happy: "Sereno",
    calm: "Tranquillo",
    neutral: "Nella norma",
    frustrated: "Frustrato",
    tired: "Stanco",
    confused: "Confuso",
    proud: "Soddisfatto",
  };

  const hasActivity = todaySessions.length > 0 || todayTasks.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Oggi</h3>
          <p className="text-[11px] text-muted-foreground">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {!hasActivity ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {childName} non ha ancora studiato oggi
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-display font-bold text-foreground text-sm">{todayMinutes}m</p>
              <p className="text-[10px] text-muted-foreground">Studio</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <BookOpen className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-display font-bold text-foreground text-sm">{todaySessions.length}</p>
              <p className="text-[10px] text-muted-foreground">Sessioni</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <CheckCircle2 className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-display font-bold text-foreground text-sm">{todayTasks.length}</p>
              <p className="text-[10px] text-muted-foreground">Completati</p>
            </div>
          </div>

          {/* Missions today */}
          {todayMissions.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Missioni: {completedMissions.length}/{todayMissions.length}
              </p>
              <div className="flex gap-1">
                {todayMissions.map((m, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${m.completed ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Last emotion */}
          {lastEmotion && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Ultima emozione registrata: <span className="font-medium text-foreground">{emotionLabels[lastEmotion] || lastEmotion}</span></span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
