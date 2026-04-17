import { cn } from "@/lib/utils";
import { Brain, BookOpen, CalendarCheck } from "lucide-react";

export interface HealthIndicator {
  key: "method" | "learning" | "consistency";
  label: string;
  /** 0–100 */
  value: number | null;
  hint?: string;
}

interface Props {
  /** 0–100 overall, null = not enough data */
  overall: number | null;
  indicators: HealthIndicator[];
  onClick?: () => void;
  className?: string;
}

const ICONS = {
  method: Brain,
  learning: BookOpen,
  consistency: CalendarCheck,
} as const;

function zoneOf(v: number | null) {
  if (v == null) return { color: "bg-muted-foreground/40", text: "text-muted-foreground", label: "—" };
  if (v < 40) return { color: "bg-red-500", text: "text-red-600", label: "Da rinforzare" };
  if (v < 70) return { color: "bg-amber-500", text: "text-amber-600", label: "Attenzione" };
  return { color: "bg-emerald-500", text: "text-emerald-600", label: "Buono" };
}

export default function ClassHealthBar({ overall, indicators, onClick, className }: Props) {
  const overallZone = zoneOf(overall);

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full text-left bg-card border border-border rounded-[16px] p-5 transition-all",
        onClick && "hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">Salute della classe</p>
        {onClick && (
          <span className="text-[11px] text-primary">tocca per i dettagli ›</span>
        )}
      </div>

      {/* Single unified bar */}
      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden mt-3">
        {overall != null && (
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all", overallZone.color)}
            style={{ width: `${Math.max(4, overall)}%` }}
          />
        )}
      </div>
      <p className={cn("text-[12px] mt-1.5 font-medium", overallZone.text)}>
        {overall == null ? "In attesa di dati" : overallZone.label}
      </p>

      {/* 3 sub-indicators */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        {indicators.map((ind) => {
          const z = zoneOf(ind.value);
          const Icon = ICONS[ind.key];
          return (
            <div key={ind.key} className="flex items-center gap-2.5 min-w-0">
              <div className={cn("shrink-0 h-7 w-7 rounded-lg flex items-center justify-center", z.color, "bg-opacity-15")}>
                <Icon className={cn("h-3.5 w-3.5", z.text)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
                  {ind.label}
                </p>
                <p className={cn("text-[12px] font-semibold leading-tight mt-0.5", z.text)}>
                  {ind.value == null ? "—" : z.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}
