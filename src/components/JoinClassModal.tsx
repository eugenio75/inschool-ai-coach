import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface JoinClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onJoined?: () => void;
}

export function JoinClassModal({ open, onOpenChange, profileId, onJoined }: JoinClassModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ class_name: string; subject: string; teacher_name: string; teacher_last_name?: string; teacher_gender?: string } | null>(null);

  const handleJoin = async () => {
    if (!code.trim() || code.trim().length < 4) return;
    setLoading(true);
    setError("");
    setSuccess(null);

    const { data, error: rpcError } = await supabase.rpc("join_class_by_code", {
      code: code.trim(),
      student_profile_id: profileId,
    });

    setLoading(false);

    if (rpcError) {
      setError(t("class_join_error_generic"));
      return;
    }

    const result = data as any;
    if (!result?.success) {
      if (result?.error === "not_found") setError(t("class_join_not_found"));
      else if (result?.error === "already_enrolled") setError(t("class_join_already"));
      else setError(t("class_join_error_generic"));
      return;
    }

    setSuccess({
      class_name: result.class_name,
      subject: result.subject || "",
      teacher_name: result.teacher_name || "",
    });
    onJoined?.();
  };

  const handleClose = () => {
    setCode("");
    setError("");
    setSuccess(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {t("class_join_title")}
          </DialogTitle>
          <DialogDescription>{t("class_join_description")}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="font-semibold text-foreground">
              {t("class_join_success", { name: success.class_name })}
            </p>
            {success.subject && (
              <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                {success.subject}
              </span>
            )}
            {success.teacher_name && (
              <p className="text-sm text-muted-foreground">
                Prof. {success.teacher_name}
              </p>
            )}
            <Button onClick={handleClose} className="rounded-xl mt-2">
              {t("class_join_done")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder={t("class_join_placeholder")}
                className="rounded-xl text-center text-lg tracking-widest font-mono uppercase"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
            <Button
              onClick={handleJoin}
              disabled={!code.trim() || code.trim().length < 4 || loading}
              className="w-full rounded-xl"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("class_join_button")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Inline join class widget for onboarding (not a modal) */
export function JoinClassInline({ profileId, onJoined }: { profileId: string; onJoined?: (result: any) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const handleJoin = async () => {
    if (!code.trim() || code.trim().length < 4) return;
    setLoading(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("join_class_by_code", {
      code: code.trim(),
      student_profile_id: profileId,
    });

    setLoading(false);
    if (rpcError) { setError(t("class_join_error_generic")); return; }

    const result = data as any;
    if (!result?.success) {
      if (result?.error === "not_found") setError(t("class_join_not_found"));
      else if (result?.error === "already_enrolled") setError(t("class_join_already"));
      else setError(t("class_join_error_generic"));
      return;
    }

    setSuccess(result);
    onJoined?.(result);
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
        <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-foreground text-sm">
            {t("class_join_success", { name: success.class_name })}
          </p>
          {success.teacher_name && (
            <p className="text-xs text-muted-foreground">Prof. {success.teacher_name}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder={t("class_join_placeholder")}
          className="rounded-xl text-center tracking-widest font-mono uppercase flex-1"
          maxLength={6}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
        <Button onClick={handleJoin} disabled={!code.trim() || code.trim().length < 4 || loading} className="rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("class_join_button")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
