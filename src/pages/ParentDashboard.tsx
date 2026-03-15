import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, BookOpen, TrendingUp, Brain, AlertCircle, Lightbulb, Shield, BarChart3, Eye, MessageCircle } from "lucide-react";
import { ProgressSun } from "@/components/ProgressSun";
import { BadgeGrid } from "@/components/GamificationBar";
import { mockGamification } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const weeklyData = mockGamification.weeklyProgress;
const maxMinutes = Math.max(...weeklyData.map((d) => d.minutes));

const insights = [
  {
    icon: TrendingUp,
    title: "Autonomia in crescita",
    text: "Questa settimana ha completato il 40% dei compiti senza chiedere aiuto. La settimana scorsa era il 25%.",
    color: "sage",
  },
  {
    icon: AlertCircle,
    title: "Matematica richiede supporto",
    text: "Le frazioni restano il punto più difficile. Il coach sta usando micro-passi e domande guidate per rafforzare la comprensione.",
    color: "terracotta",
  },
  {
    icon: Eye,
    title: "Pattern di distrazione",
    text: "Dopo 12 minuti tende a perdere concentrazione, soprattutto con materie di lettura. Le sessioni più brevi funzionano meglio.",
    color: "clay",
  },
  {
    icon: Brain,
    title: "Punti di forza cognitivi",
    text: "Eccelle nel ragionamento visivo-spaziale e nella memorizzazione per schemi. Le scienze sono la materia dove dimostra più autonomia.",
    color: "sage",
  },
  {
    icon: Lightbulb,
    title: "Consiglio per ridurre i conflitti",
    text: "Evita di chiedere 'Hai finito i compiti?'. Prova con 'Come è andata la sessione oggi?' oppure 'Cosa hai scoperto di interessante?'",
    color: "clay",
  },
  {
    icon: MessageCircle,
    title: "Comunicazione con il coach",
    text: "Quando si sente bloccato, risponde meglio a indizi concreti che a spiegazioni teoriche. Lo stile 'gentile e paziente' è il più efficace.",
    color: "sage",
  },
];

const colorMap: Record<string, { bg: string; icon: string }> = {
  sage: { bg: "bg-sage-light", icon: "text-sage-dark" },
  terracotta: { bg: "bg-terracotta-light", icon: "text-terracotta" },
  clay: { bg: "bg-clay-light", icon: "text-clay-dark" },
};

const subjectDifficulty = [
  { subject: "Matematica", difficulty: 78, trend: "up" },
  { subject: "Italiano", difficulty: 35, trend: "stable" },
  { subject: "Storia", difficulty: 55, trend: "down" },
  { subject: "Scienze", difficulty: 20, trend: "down" },
];

const ParentDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-semibold text-foreground">Area Genitori</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              Panoramica della settimana
            </h1>
            <p className="text-muted-foreground text-sm">
              Ecco come sta andando. Niente voti, solo crescita.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 -mt-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
              <div className="flex justify-center mb-2">
                <ProgressSun progress={0.72} size={40} />
              </div>
              <p className="text-xs text-muted-foreground">Autonomia</p>
              <p className="font-display font-bold text-foreground">72%</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
              <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-sage-dark" />
              </div>
              <p className="text-xs text-muted-foreground">Focus totale</p>
              <p className="font-display font-bold text-foreground">3h 15m</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
              <div className="w-10 h-10 rounded-xl bg-clay-light flex items-center justify-center mx-auto mb-2">
                <Brain className="w-5 h-5 text-clay-dark" />
              </div>
              <p className="text-xs text-muted-foreground">Compiti fatti</p>
              <p className="font-display font-bold text-foreground">18</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-5 shadow-soft"
          >
            <h3 className="font-display font-semibold text-foreground mb-4">Tempo di studio</h3>
            <div className="flex items-end justify-between gap-2 h-32">
              {weeklyData.map((d, i) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${maxMinutes > 0 ? (d.minutes / maxMinutes) * 100 : 0}%` }}
                    transition={{ ...spring, delay: 0.3 + i * 0.05 }}
                    className="w-full rounded-lg bg-primary min-h-[4px]"
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Autonomy trend */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
            className="bg-card rounded-2xl border border-border p-5 shadow-soft"
          >
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sage-dark" />
              Livello di autonomia per giorno
            </h3>
            <div className="flex items-end justify-between gap-2 h-20">
              {weeklyData.map((d, i) => (
                <div key={`a-${d.day}`} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${d.autonomy}%` }}
                    transition={{ ...spring, delay: 0.35 + i * 0.05 }}
                    className="w-full rounded-lg bg-secondary min-h-[4px]"
                  />
                  <span className="text-[10px] text-muted-foreground">{d.autonomy > 0 ? `${d.autonomy}%` : "—"}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Subject difficulty */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-5 shadow-soft"
          >
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-clay-dark" />
              Difficoltà per materia
            </h3>
            <div className="space-y-3">
              {subjectDifficulty.map((item) => (
                <div key={item.subject} className="flex items-center gap-3">
                  <span className="text-sm text-foreground w-24 font-medium">{item.subject}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.difficulty}%` }}
                      transition={spring}
                      className={`h-full rounded-full ${
                        item.difficulty > 60 ? "bg-terracotta" : item.difficulty > 40 ? "bg-secondary" : "bg-primary"
                      }`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {item.trend === "up" ? "📈" : item.trend === "down" ? "📉" : "➡️"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Badges earned */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
          >
            <h3 className="font-display font-semibold text-foreground mb-4">Badge guadagnati</h3>
            <BadgeGrid />
          </motion.div>
        </div>
      </div>

      {/* Insights */}
      <div className="px-6 mt-8">
        <div className="max-w-2xl mx-auto space-y-3">
          <h3 className="font-display font-semibold text-foreground">Osservazioni e consigli</h3>
          {insights.map((insight, i) => {
            const colors = colorMap[insight.color];
            return (
              <motion.div
                key={insight.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.4 + i * 0.08 }}
                className="bg-card rounded-2xl border border-border p-5 shadow-soft"
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <insight.icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-foreground text-sm mb-1">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
