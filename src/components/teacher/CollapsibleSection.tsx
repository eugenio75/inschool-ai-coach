import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Small badge shown next to title (e.g. count) */
  badge?: ReactNode;
  /** Optional subtle accent (used by "Studenti da seguire") */
  accent?: "amber" | "default";
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional small text on the right (e.g. "1 da seguire") */
  meta?: string;
}

export default function CollapsibleSection({
  title,
  badge,
  accent = "default",
  defaultOpen = false,
  children,
  meta,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-[16px] border bg-card overflow-hidden transition-colors",
        accent === "amber" ? "border-amber-300/50" : "border-border",
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-5 py-4 text-left transition-colors",
          accent === "amber" ? "hover:bg-amber-50/40" : "hover:bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          {badge}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta && <span className="text-[11px] text-muted-foreground">{meta}</span>}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
