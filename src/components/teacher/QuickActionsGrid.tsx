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
    <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
      <div className="mb-4">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-foreground tracking-tight">
          Azioni rapide
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Strumenti puri, separati dalla lettura del Coach.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {actions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <button
              key={a.id}
              onClick={a.onClick}
              className="group rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground/70 mb-2 group-hover:bg-foreground group-hover:text-background transition-colors">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-[14px] font-semibold text-foreground leading-tight">{a.label}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{a.sublabel}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
