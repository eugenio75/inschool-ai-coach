import { useState, useEffect } from "react";
import { Users, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { JoinClassModal } from "./JoinClassModal";
import { useTranslation } from "react-i18next";
import { formatTeacherDisplay } from "@/lib/teacherTitle";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EnrolledClass {
  enrollment_id: string;
  class_id: string;
  class_name: string;
  subject: string | null;
  teacher_name: string;
  teacher_last_name?: string;
  teacher_gender?: string;
  enrolled_at: string;
}

export function MyClassesSection({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<EnrolledClass | null>(null);
  const [leaving, setLeaving] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_student_classes", { student_profile_id: profileId });
    setClasses(Array.isArray(data) ? (data as unknown as EnrolledClass[]) : []);
    setLoading(false);
  };

  useEffect(() => { loadClasses(); }, [profileId]);

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    await supabase.rpc("leave_class", {
      enrollment_id: leaveTarget.enrollment_id,
      student_profile_id: profileId,
    });
    setLeaving(false);
    setLeaveTarget(null);
    loadClasses();
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
      <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" /> {t("class_my_classes")}
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : classes.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">{t("class_no_classes")}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {classes.map((c) => (
            <div key={c.enrollment_id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div>
                <p className="font-medium text-foreground text-sm">{c.class_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.subject && (
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {c.subject}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatTeacherDisplay(c.teacher_name, c.teacher_last_name, c.teacher_gender)}</span>
                </div>
              </div>
              <button
                onClick={() => setLeaveTarget(c)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                title={t("class_leave")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={() => setShowJoin(true)} className="w-full rounded-xl border-border">
        <Plus className="w-4 h-4 mr-2" /> {t("class_join_cta")}
      </Button>

      <JoinClassModal
        open={showJoin}
        onOpenChange={setShowJoin}
        profileId={profileId}
        onJoined={loadClasses}
      />

      <AlertDialog open={!!leaveTarget} onOpenChange={() => setLeaveTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("class_leave_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("class_leave_description", { name: leaveTarget?.class_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("class_leave_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? t("class_leave_leaving") : t("class_leave_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
