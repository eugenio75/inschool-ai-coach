import { PhoneFrame } from "./PhoneFrame";
import { useLang } from "@/contexts/LangContext";

function CoachBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-0.5"
        style={{ backgroundColor: "#0070C0" }}
      >
        IN
      </div>
      <div
        className="rounded-2xl rounded-tl-md px-3 py-2.5 text-[13px] leading-relaxed max-w-[85%]"
        style={{ backgroundColor: "#F1F5F9", color: "#1A3A5C" }}
      >
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div
        className="rounded-2xl rounded-tr-md px-3 py-2.5 text-[13px] leading-relaxed text-white"
        style={{ backgroundColor: "#0070C0" }}
      >
        {text}
      </div>
    </div>
  );
}

export function HomeChatMockup() {
  const { t } = useLang();
  return (
    <PhoneFrame>
      <p
        className="text-[11px] font-semibold uppercase tracking-wider mb-4"
        style={{ color: "#94A3B8" }}
      >
        {t("mockup_coach_label")}
      </p>
      <CoachBubble text={t("mockup_student_coach_1")} />
      <UserBubble text={t("mockup_student_user")} />
      <CoachBubble text={t("mockup_student_coach_2")} />

      {/* Input bar */}
      <div
        className="mt-4 rounded-full px-4 py-2.5 flex items-center gap-2 text-[13px]"
        style={{
          backgroundColor: "#F8FAFC",
          border: "1px solid #E2E8F0",
          color: "#94A3B8",
        }}
      >
        {t("mockup_input_placeholder")}
      </div>
    </PhoneFrame>
  );
}
