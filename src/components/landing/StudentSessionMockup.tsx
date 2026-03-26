import { BrowserFrame } from "./BrowserFrame";

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: i < current ? "#0070C0" : "#E2E8F0" }}
        />
      ))}
      <span className="text-[10px] ml-1.5" style={{ color: "#94A3B8" }}>
        Passo {current} di {total}
      </span>
    </div>
  );
}

export function StudentSessionMockup() {
  return (
    <PhoneFrame>
      {/* Header */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
          Sessione guidata
        </p>
        <p className="text-sm font-bold mt-1" style={{ color: "#1A3A5C" }}>
          Analisi del testo — "I Promessi Sposi"
        </p>
      </div>

      <ProgressDots current={2} total={6} />

      <div className="mt-4 mb-3">
        <div className="flex gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-0.5"
            style={{ backgroundColor: "#0070C0" }}
          >
            IN
          </div>
          <div
            className="rounded-2xl rounded-tl-md px-3 py-2 text-xs leading-relaxed"
            style={{ backgroundColor: "#F1F5F9", color: "#1A3A5C" }}
          >
            Hai letto il brano. Dimmi con parole tue di cosa parla questo paragrafo.
          </div>
        </div>
      </div>

      {/* Input area */}
      <div
        className="rounded-xl px-3 py-3 text-xs mb-3"
        style={{
          backgroundColor: "#FAFAFA",
          border: "1px solid #0070C0",
          color: "#94A3B8",
          minHeight: 56,
        }}
      >
        Scrivi la tua risposta...
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}
        >
          Sono bloccato
        </button>
        <button
          className="rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}
        >
          Dammi un indizio
        </button>
      </div>
    </PhoneFrame>
  );
}
