import { PhoneFrame } from "./PhoneFrame";
import { useLang } from "@/contexts/LangContext";

function ProgressDots({ current, total, stepLabel }: { current: number; total: number; stepLabel: string }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: i < current ? "#0070C0" : "#E2E8F0" }}
        />
      ))}
      <span className="text-[11px] ml-1.5 font-medium" style={{ color: "#94A3B8" }}>
        {stepLabel}
      </span>
    </div>
  );
}

export function StudentSessionMockup() {
  const { t } = useLang();
  return (
    <PhoneFrame>
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
          {t("mockup_session_label")}
        </p>
      </div>

      <div
        className="rounded-xl p-3 mb-3"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        <p className="text-[14px] font-bold" style={{ color: "#1A3A5C" }}>
          {t("mockup_session_title")}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>
          {t("mockup_session_subtitle")}
        </p>
      </div>

      <ProgressDots current={2} total={5} stepLabel={t("mockup_session_step").replace("{{current}}", "2").replace("{{total}}", "5")} />

      <div className="mt-4 mb-4">
        <div className="flex gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-0.5"
            style={{ backgroundColor: "#0070C0" }}
          >
            IN
          </div>
          <div
            className="rounded-2xl rounded-tl-md px-3 py-2.5 text-[13px] leading-relaxed"
            style={{ backgroundColor: "#F1F5F9", color: "#1A3A5C" }}
          >
            {t("mockup_session_coach")}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <span
          className="rounded-full px-4 py-2 text-[12px] font-medium cursor-pointer"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}
        >
          {t("mockup_session_stuck")}
        </span>
        <span
          className="rounded-full px-4 py-2 text-[12px] font-medium cursor-pointer"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}
        >
          {t("mockup_session_hint")}
        </span>
      </div>
    </PhoneFrame>
  );
}
