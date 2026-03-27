import { BrowserFrame } from "./BrowserFrame";

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
  return (
    <BrowserFrame>
      {/* Greeting */}
      <p className="text-[17px] font-bold" style={{ color: "#1A3A5C" }}>
        Buon pomeriggio, Prof. Chieffe
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
          La verifica di Musica della 3G scade domani — solo 3 studenti l'hanno completata. Come vuoi procedere?
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
        Scrivi al coach...
      </div>

      {/* Classes */}
      <div className="mt-5">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "#94A3B8" }}
        >
          Classi attive
        </p>
        <ClassRow name="1D" subject="Educazione Civica" status="2 da seguire" statusColor="#D97706" />
        <ClassRow name="2E" subject="Musica" status="Regolare" statusColor="#16A34A" />
        <ClassRow name="3G" subject="Musica" status="3 da seguire" statusColor="#D97706" />
      </div>
    </BrowserFrame>
  );
}
