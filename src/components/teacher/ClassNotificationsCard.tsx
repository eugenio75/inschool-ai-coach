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

const STYLES: Record<NotificationLevel, { iconBg: string; iconText: string; pill: string }> = {
  attention: {
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  urgent: {
    iconBg: "bg-red-100 dark:bg-red-500/15",
    iconText: "text-red-600 dark:text-red-400",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  info: {
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
};

export default function ClassNotificationsCard({ notifications }: Props) {
  return (
    <div>
      <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 sm:mb-3 px-1">
        Notifiche
      </p>
      <div className="rounded-[20px] bg-card border border-border/60 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-[13px] sm:text-[14px] text-muted-foreground">Nessuna notifica al momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {notifications.map((n) => {
              const Icon = ICONS[n.level];
              const styles = STYLES[n.level];
              return (
                <button
                  key={n.id}
                  onClick={n.onClick}
                  disabled={!n.onClick}
                  className={cn(
                    "w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 text-left transition-colors",
                    n.onClick && "hover:bg-muted/40",
                  )}
                >
                  <span className={cn("shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-[10px] sm:rounded-[12px] flex items-center justify-center", styles.iconBg)}>
                    <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", styles.iconText)} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] sm:text-[15px] font-semibold text-foreground leading-tight truncate">{n.title}</p>
                    <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5 leading-tight truncate">{n.subtitle}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] font-semibold",
                    styles.pill,
                  )}>
                    {n.badgeLabel}
                  </span>
                  {n.onClick && <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
