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
    <section>
      <div className="mb-4 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <h3 className="text-[13px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Azioni rapide
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <button
              key={a.id}
              onClick={a.onClick}
              className="group rounded-[26px] border border-border/60 bg-card/95 backdrop-blur p-5 text-left shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.08)] transition-all hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)]"
            >
              <div className="mb-5 h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-[30px] font-bold tracking-tight text-foreground leading-tight">
                {a.label}
              </p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {a.sublabel}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
