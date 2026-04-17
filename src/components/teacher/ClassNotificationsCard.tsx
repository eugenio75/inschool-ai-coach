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
    <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
      <div className="mb-4">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-foreground tracking-tight">
          Attività della classe
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Completate, in corso, consigliate. Tutto in una vista sola.
        </p>
      </div>
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-border/60 p-6 text-center">
          <p className="text-[13px] sm:text-[14px] text-muted-foreground">Nessuna notifica al momento.</p>
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
                  "w-full flex items-center gap-3 sm:gap-4 rounded-2xl border border-border/70 p-4 text-left transition-colors",
                  n.onClick && "hover:bg-muted/40",
                )}
              >
                <span className={cn("shrink-0 h-10 w-10 rounded-xl flex items-center justify-center", styles.iconBg)}>
                  <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", styles.iconText)} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] sm:text-[15px] font-semibold text-foreground leading-tight">{n.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{n.subtitle}</p>
                </div>
                <span className={cn(
                  "shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-[12px] font-semibold",
                  styles.pill,
                )}>
                  {n.badgeLabel}
                </span>
                {n.onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
