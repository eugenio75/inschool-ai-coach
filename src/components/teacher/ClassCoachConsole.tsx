import { Sparkles, Wrench, Mail, ArrowRight, Brain, BookOpen, CalendarCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/shared/AvatarInitials";

export interface CoachAction {
  id: string;
  label: string;
  icon: "recovery" | "parents" | "next";
  onClick: () => void;
  variant?: "primary" | "ghost";
}

export interface FollowStudent {
  studentId: string;
  studentName: string;
  reason: string;
  primaryAction?: CoachAction;
  onOpen: () => void;
}

export interface HealthIndicator {
  key: "method" | "learning" | "consistency";
  label: string;
  /** 0–100, null if not enough data */
  value: number | null;
}

interface Props {
  coachName?: string;
  /** Coach interpretive message (the "voice") */
  message: string;
  /** Overall health 0-100, null = not enough data */
  overall: number | null;
  indicators: HealthIndicator[];
  /** General class actions (1-2 max). Student-specific actions go in `followStudents` */
  actions?: CoachAction[];
  /** Students that need attention — surfaced inline under the Coach voice */
  followStudents?: FollowStudent[];
  /** Open the deep-dive modal */
  onOpenHealthDetails?: () => void;
}

const ACTION_ICONS = {
  recovery: Wrench,
  parents: Mail,
  next: ArrowRight,
} as const;

const HEALTH_ICONS = {
  method: Brain,
  learning: BookOpen,
  consistency: CalendarCheck,
} as const;

function zoneOf(v: number | null) {
  if (v == null) return { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "—", pill: "bg-muted text-muted-foreground" };
  if (v < 40) return { dot: "bg-red-500", text: "text-red-600", label: "Da rinforzare", pill: "bg-red-50 text-red-700 border-red-200" };
  if (v < 70) return { dot: "bg-amber-500", text: "text-amber-600", label: "Attenzione", pill: "bg-amber-50 text-amber-700 border-amber-200" };
  return { dot: "bg-emerald-500", text: "text-emerald-700", label: "Buono", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function ClassCoachConsole({
  coachName = "Astro",
  message,
  overall,
  indicators,
  actions = [],
  followStudents = [],
  onOpenHealthDetails,
}: Props) {
  const overallZone = zoneOf(overall);

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-primary/15 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {/* Soft ambient glow */}
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* ─── LAYER 1: STATO (top strip) ─── */}
      <button
        onClick={onOpenHealthDetails}
        disabled={!onOpenHealthDetails}
        className={cn(
          "relative w-full flex items-center justify-between gap-3 px-5 py-3 border-b border-primary/10 text-left transition-colors",
          onOpenHealthDetails && "hover:bg-primary/[0.03]",
        )}
      >
        <div className="flex items-center gap-x-5 gap-y-2 min-w-0 flex-wrap">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold shrink-0",
            overallZone.pill,
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", overallZone.dot)} />
            <span>Salute:</span>
            <span>{overallZone.label}</span>
          </span>

          <span className="hidden sm:inline-flex items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground flex-wrap">
            {indicators.map((ind) => {
              const z = zoneOf(ind.value);
              const Icon = HEALTH_ICONS[ind.key];
              return (
                <span key={ind.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Icon className={cn("h-3 w-3 shrink-0", z.text)} />
                  <span>{ind.label}</span>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", z.dot)} />
                </span>
              );
            })}
          </span>
        </div>
        {onOpenHealthDetails && (
          <span className="text-[11px] text-primary shrink-0 ml-2">dettagli ›</span>
        )}
      </button>

      {/* ─── LAYER 2: VOCE DEL COACH ─── */}
      <div className="relative px-5 pt-5 pb-4">
        <div className="flex gap-3.5">
          <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70 mb-1">
              {coachName} · Coach AI
            </p>
            <p className="text-[15px] leading-relaxed text-foreground">
              {message}
            </p>

            {/* General class-level actions */}
            {actions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((a) => {
                  const Icon = ACTION_ICONS[a.icon];
                  const isPrimary = (a.variant ?? "primary") === "primary";
                  return (
                    <Button
                      key={a.id}
                      onClick={a.onClick}
                      size="sm"
                      variant={isPrimary ? "default" : "ghost"}
                      className={cn(
                        "h-8 rounded-full text-xs font-medium",
                        isPrimary
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      {a.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── LAYER 3: AZIONI MIRATE (Studenti da seguire inline) ─── */}
      {followStudents.length > 0 && (
        <div className="relative border-t border-primary/10 bg-card/40 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            {followStudents.length === 1 ? "1 studente da seguire" : `${followStudents.length} studenti da seguire`}
          </p>
          <div className="space-y-1.5">
            {followStudents.map((fs) => {
              const PrimaryIcon = fs.primaryAction ? ACTION_ICONS[fs.primaryAction.icon] : null;
              return (
                <div
                  key={fs.studentId}
                  className="group flex items-center gap-3 rounded-[12px] bg-card border border-border/60 p-2.5 hover:border-amber-300/60 hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all"
                >
                  <button
                    onClick={fs.onOpen}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <AvatarInitials name={fs.studentName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {fs.studentName}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {fs.reason}
                      </p>
                    </div>
                  </button>

                  {fs.primaryAction && PrimaryIcon && (
                    <Button
                      onClick={fs.primaryAction.onClick}
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full text-[11px] font-medium text-primary hover:bg-primary/10 px-3 shrink-0"
                    >
                      <PrimaryIcon className="h-3.5 w-3.5 mr-1" />
                      {fs.primaryAction.label}
                    </Button>
                  )}
                  <button
                    onClick={fs.onOpen}
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Apri ${fs.studentName}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
