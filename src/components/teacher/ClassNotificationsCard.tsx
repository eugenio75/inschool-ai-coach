import { ChevronRight, AlertTriangle, CheckCircle2, AlertCircle, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationLevel = "attention" | "completed" | "urgent" | "info";

export interface ClassNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  subtitle: string;
  badgeLabel: string;
  onClick?: () => void;
}

interface Props {
  notifications: ClassNotification[];
}

const ICONS: Record<NotificationLevel, LucideIcon> = {
  attention: AlertTriangle,
  completed: CheckCircle2,
  urgent: AlertCircle,
  info: Info,
};

const STYLES: Record<NotificationLevel, { dot: string; iconBg: string; iconText: string; pill: string }> = {
  attention: {
    dot: "bg-amber-300",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    dot: "bg-emerald-300",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  urgent: {
    dot: "bg-red-300",
    iconBg: "bg-red-100 dark:bg-red-500/15",
    iconText: "text-red-600 dark:text-red-400",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  info: {
    dot: "bg-blue-300",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
};

export default function ClassNotificationsCard({ notifications }: Props) {
  const headerDot = notifications[0] ? STYLES[notifications[0].level].dot : "bg-muted-foreground/30";

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <div className={cn("h-2.5 w-2.5 rounded-full", headerDot)} />
        <h3 className="text-[13px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Notifiche
        </h3>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-[28px] border border-border/60 bg-card/95 backdrop-blur p-6 text-center shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.08)]">
          <p className="text-[14px] text-muted-foreground">Nessuna notifica al momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = ICONS[n.level];
            const styles = STYLES[n.level];
            return (
              <button
                key={n.id}
                onClick={n.onClick}
                disabled={!n.onClick}
                className={cn(
                  "w-full flex items-center gap-4 rounded-[28px] border border-border/60 bg-card/95 backdrop-blur p-5 text-left shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.08)] transition-all",
                  n.onClick && "hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)]",
                )}
              >
                <span className={cn("shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center", styles.iconBg)}>
                  <Icon className={cn("h-6 w-6", styles.iconText)} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
                    {n.title}
                  </p>
                  <p className="mt-1 text-[14px] sm:text-[15px] text-muted-foreground">
                    {n.subtitle}
                  </p>
                </div>
                <span className={cn(
                  "shrink-0 inline-flex items-center px-4 py-2 rounded-full text-[13px] font-semibold",
                  styles.pill,
                )}>
                  {n.badgeLabel}
                </span>
                {n.onClick && <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
