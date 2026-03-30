import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ReportTeacherButtonProps {
  teacherId: string;
  className?: string;
}

export function ReportTeacherButton({ teacherId, className }: ReportTeacherButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const handleReport = async () => {
    if (!user?.id || !reason.trim()) return;
    setSending(true);
    try {
      const { error } = await (supabase as any)
        .from("teacher_reports")
        .insert({
          teacher_id: teacherId,
          reported_by: user.id,
          reason: reason.trim(),
        });
      if (error) throw error;
      toast.success("Segnalazione inviata");
      setOpen(false);
      setReason("");
    } catch {
      toast.error("Errore nell'invio della segnalazione");
    }
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ${className || ""}`}
      >
        <Flag className="w-3 h-3" />
        Segnala
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Segnala un problema</DialogTitle>
            <DialogDescription>
              La segnalazione sarà gestita in modo riservato.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descrivi il motivo della segnalazione..."
            className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary text-sm min-h-[80px] resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button size="sm" disabled={!reason.trim() || sending} onClick={handleReport}>
              {sending ? "Invio..." : "Invia segnalazione"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
