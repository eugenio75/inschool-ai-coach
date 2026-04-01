import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JoinClassModal } from "./JoinClassModal";
import { useTranslation } from "react-i18next";
import { formatTeacherDisplay } from "@/lib/teacherTitle";

/** Shows a subtle join-class prompt when the student has no enrollments */
export function JoinClassPrompt({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const [hasClasses, setHasClasses] = useState<boolean | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [enrolledInfo, setEnrolledInfo] = useState<any>(null);

  useEffect(() => {
    if (!profileId) return;
    supabase.rpc("get_student_classes", { student_profile_id: profileId }).then(({ data }) => {
      const classes = Array.isArray(data) ? data : [];
      setHasClasses(classes.length > 0);
      if (classes.length > 0) setEnrolledInfo(classes[0]);
    });
  }, [profileId]);

  // Show enrolled class info
  if (hasClasses && enrolledInfo) {
    return (
      <div className="text-xs text-muted-foreground">
        {t("class_enrolled_line", {
          className: enrolledInfo.class_name,
          teacher: formatTeacherDisplay(enrolledInfo.teacher_name, enrolledInfo.teacher_last_name, enrolledInfo.teacher_gender),
        })}
      </div>
    );
  }

  // Show join prompt only if no classes
  if (hasClasses === false) {
    return (
      <>
        <button
          onClick={() => setShowJoin(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full"
        >
          <Users className="w-4 h-4 text-primary shrink-0" />
          <span>{t("class_join_prompt")}</span>
        </button>
        <JoinClassModal
          open={showJoin}
          onOpenChange={setShowJoin}
          profileId={profileId}
          onJoined={() => {
            setHasClasses(true);
            supabase.rpc("get_student_classes", { student_profile_id: profileId }).then(({ data }) => {
              const classes = Array.isArray(data) ? data : [];
              if (classes.length > 0) setEnrolledInfo(classes[0]);
            });
          }}
        />
      </>
    );
  }

  return null;
}
