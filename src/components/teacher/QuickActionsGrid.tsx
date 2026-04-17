import { Plus, Camera, Users, BookOpen, type LucideIcon } from "lucide-react";

export type QuickActionIcon = "create" | "grade" | "students" | "library";

export interface QuickAction {
  id: string;
  icon: QuickActionIcon;
  label: string;
  sublabel: string;
  onClick: () => void;
}

const ICONS: Record<QuickActionIcon, LucideIcon> = {
  create: Plus,
  grade: Camera,
  students: Users,
  library: BookOpen,
};

interface Props {
  actions: QuickAction[];
}

export default function QuickActionsGrid({ actions }: Props) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 px-1">
        Azioni rapide
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <button
              key={a.id}
              onClick={a.onClick}
              className="group rounded-[18px] bg-card border border-border/60 p-3.5 text-left transition-all hover:border-foreground/15 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted text-foreground mb-2.5 group-hover:bg-foreground group-hover:text-background transition-colors">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-[14px] font-semibold text-foreground leading-tight">{a.label}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{a.sublabel}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
