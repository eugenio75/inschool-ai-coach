import { BrowserFrame } from "./BrowserFrame";
import { useLang } from "@/contexts/LangContext";

function ClassRow({
  name,
  subject,
  status,
  statusColor,
}: {
  name: string;
  subject: string;
  status: string;
  statusColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "#0070C0" }}
        />
        <span className="text-[14px] font-medium" style={{ color: "#1A3A5C" }}>
          {name}
        </span>
        <span className="text-[13px]" style={{ color: "#94A3B8" }}>
          {subject}
        </span>
      </div>
      <span className="text-[12px] font-medium" style={{ color: statusColor }}>
        {status}
      </span>
    </div>
  );
}

export function TeacherHomeMockup() {
  const { t } = useLang();
  return (
    <BrowserFrame>
      {/* Greeting */}
      <p className="text-[17px] font-bold" style={{ color: "#1A3A5C" }}>
        {t("mockup_teacher_greeting")}
      </p>

      {/* Coach message */}
      <div
        className="rounded-xl p-4 mt-4 flex gap-3"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
          style={{ backgroundColor: "#0070C0" }}
        >
          IN
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: "#334155" }}>
          {t("mockup_teacher_coach")}
        </p>
      </div>

      {/* Input */}
      <div
        className="mt-3 rounded-lg px-4 py-3 text-[13px]"
        style={{
          backgroundColor: "#FAFAFA",
          border: "1px solid #E2E8F0",
          color: "#94A3B8",
        }}
      >
        {t("mockup_teacher_input")}
      </div>

      {/* Classes */}
      <div className="mt-5">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "#94A3B8" }}
        >
          {t("mockup_classes_title")}
        </p>
        <ClassRow name="1D" subject={t("mockup_class_1")} status={`2 ${t("mockup_status_follow").toLowerCase()}`} statusColor="#D97706" />
        <ClassRow name="2E" subject={t("mockup_class_2")} status={t("mockup_status_regular")} statusColor="#16A34A" />
        <ClassRow name="3G" subject={t("mockup_class_2")} status={`3 ${t("mockup_status_follow").toLowerCase()}`} statusColor="#D97706" />
      </div>
    </BrowserFrame>
  );
}
