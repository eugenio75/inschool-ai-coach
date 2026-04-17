import { Plus, Camera, Users, BookOpen, type LucideIcon } from "lucide-react";

export type QuickActionKind = "action" | "consult";
export type QuickActionIcon = "create" | "grade" | "students" | "library";

export interface QuickAction {
  id: string;
  icon: QuickActionIcon;
  label: string;
  sublabel: string;
  onClick: () => void;
  /** Used to group rows: "action" first row, "consult" second. Default inferred from icon. */
  kind?: QuickActionKind;
}

const ICONS: Record<QuickActionIcon, LucideIcon> = {
  create: Plus,
  grade: Camera,
  students: Users,
  library: BookOpen,
};

const KIND_BY_ICON: Record<QuickActionIcon, QuickActionKind> = {
  create: "action",
  grade: "action",
  students: "consult",
  library: "consult",
};

interface Props {
  actions: QuickAction[];
}

export default function QuickActionsGrid({ actions }: Props) {
  // Split into two rows by kind to mirror the mockup (action row + consult row).
  const decorated = actions.map((a) => ({ ...a, _kind: a.kind ?? KIND_BY_ICON[a.icon] }));
  const actionRow = decorated.filter((a) => a._kind === "action");
  const consultRow = decorated.filter((a) => a._kind === "consult");
  const groups = [actionRow, consultRow].filter((g) => g.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group, i) => (
        <section key={i} className="grid gap-4 md:grid-cols-2">
          {group.map((a) => {
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
                <p className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                  {a.label}
                </p>
                <p className="mt-2 text-[15px] text-muted-foreground">
                  {a.sublabel}
                </p>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
