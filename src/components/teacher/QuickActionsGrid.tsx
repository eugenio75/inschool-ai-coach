export type QuickActionKind = "action" | "consult";
export type QuickActionIcon = "create" | "grade" | "students" | "library";

export interface QuickAction {
  id: string;
  icon: QuickActionIcon;
  label: string;
  sublabel: string;
  onClick: () => void;
  /** "action" → kicker "AZIONE", "consult" → kicker "CONSULTA". Default inferred from icon. */
  kind?: QuickActionKind;
}

const KIND_BY_ICON: Record<QuickActionIcon, QuickActionKind> = {
  create: "action",
  grade: "action",
  students: "consult",
  library: "consult",
};

const KIND_LABEL: Record<QuickActionKind, string> = {
  action: "Azione",
  consult: "Consulta",
};

interface Props {
  actions: QuickAction[];
}

export default function QuickActionsGrid({ actions }: Props) {
  // Split into two rows by kind to mirror the mockup (Azione / Consulta).
  const decorated = actions.map((a) => ({ ...a, _kind: a.kind ?? KIND_BY_ICON[a.icon] }));
  const actionRow = decorated.filter((a) => a._kind === "action");
  const consultRow = decorated.filter((a) => a._kind === "consult");
  const groups = [actionRow, consultRow].filter((g) => g.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group, i) => (
        <section key={i} className="grid gap-4 md:grid-cols-2">
          {group.map((a) => (
            <button
              key={a.id}
              onClick={a.onClick}
              className="group rounded-[26px] border border-border/60 bg-card/95 backdrop-blur p-5 text-left shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.08)] transition-all hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                {KIND_LABEL[a._kind]}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground leading-tight">
                {a.label}
              </p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {a.sublabel}
              </p>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
