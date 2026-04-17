import { Plus, Camera, PenLine, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButton {
  id: string;
  label: string;
  sublabel?: string;
  icon: "create" | "ocr" | "grade" | "students";
  onClick: () => void;
  highlight?: boolean;
}

interface Props {
  actions: ActionButton[];
}

const ICONS = {
  create: Plus,
  ocr: Camera,
  grade: PenLine,
  students: Users,
} as const;

export default function ClassActionToolbar({ actions }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {actions.map((a) => {
        const Icon = ICONS[a.icon];
        return (
          <button
            key={a.id}
            onClick={a.onClick}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-[14px] border p-3.5 text-left transition-all",
              "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-0.5",
              a.highlight
                ? "border-primary/30 bg-primary/[0.04] hover:border-primary/50 hover:bg-primary/[0.06]"
                : "border-border bg-card hover:border-foreground/20",
            )}
          >
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
                a.highlight
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground group-hover:bg-foreground group-hover:text-background",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-tight">{a.label}</p>
              {a.sublabel && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{a.sublabel}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
