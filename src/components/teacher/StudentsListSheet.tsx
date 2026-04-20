import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { ChevronRight } from "lucide-react";
import { formatName } from "@/lib/formatName";

interface Student {
  id: string;
  name: string;
  lastActivity?: string;
  needsFollow?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  students: Student[];
}

export default function StudentsListSheet({ open, onOpenChange, classId, students }: Props) {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <SheetTitle>Studenti ({students.length})</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nessuno studente iscritto.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/studente/${s.id}?classId=${classId}`);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                >
                  <AvatarInitials name={formatName(s.name)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{formatName(s.name)}</p>
                    {s.lastActivity && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Ultima attività: {s.lastActivity}
                      </p>
                    )}
                  </div>
                  {s.needsFollow && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                      Da seguire
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
