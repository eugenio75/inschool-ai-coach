import { PhoneFrame } from "./PhoneFrame";

function TaskRow({
  subject,
  title,
  deadline,
  minutes,
}: {
  subject: string;
  title: string;
  deadline: string;
  minutes: number;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3"
      style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
    >
      <div
        className="w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5"
        style={{ borderColor: "#CBD5E1" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "#1A3A5C" }}>
          {subject} — {title}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>
          {deadline} · {minutes} min
        </p>
      </div>
    </div>
  );
}

export function StudentReviewMockup() {
  return (
    <PhoneFrame>
      {/* Greeting */}
      <p className="text-[16px] font-bold" style={{ color: "#1A3A5C" }}>
        Buonasera, Sofia
      </p>

      {/* Coach message */}
      <div className="flex gap-2 mt-3 mb-4">
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
          Hai due cose per domani. Iniziamo dalla più urgente?
        </div>
      </div>

      {/* Section label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-wider mb-3"
        style={{ color: "#94A3B8" }}
      >
        Oggi
      </p>

      {/* Task list */}
      <div className="space-y-2.5">
        <TaskRow
          subject="Matematica"
          title="Espressioni"
          deadline="Scade domani"
          minutes={20}
        />
        <TaskRow
          subject="Italiano"
          title="Analisi testo"
          deadline="Scade giovedì"
          minutes={35}
        />
      </div>
    </PhoneFrame>
  );
}
