import { BrowserFrame } from "./BrowserFrame";
import { Sparkles } from "lucide-react";

export function TeacherGenerateMockup() {
  return (
    <BrowserFrame>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5" style={{ color: "#0070C0" }} />
        <p className="text-base font-bold" style={{ color: "#1A3A5C" }}>
          Genera con AI
        </p>
      </div>

      {/* Form */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold" style={{ color: "#94A3B8" }}>
            Tipo:
          </span>
          <span
            className="text-[11px] font-medium rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: "rgba(0,112,192,0.1)", color: "#0070C0" }}
          >
            Verifica
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>
          "Una verifica sui Promessi Sposi per una terza media, 8 domande misto aperto e chiuso, difficoltà media."
        </p>
        <div className="flex justify-end mt-3">
          <span
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: "#0070C0" }}
          >
            Genera
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-4" />

      {/* Preview */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#94A3B8" }}>
          Anteprima generata
        </p>
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "#FAFAFA", border: "1px solid #E2E8F0" }}
        >
          <p className="text-sm font-bold" style={{ color: "#1A3A5C" }}>
            Verifica — I Promessi Sposi
          </p>
          <p className="text-[10px] mb-3" style={{ color: "#94A3B8" }}>
            Classe 3 · Letteratura italiana
          </p>

          <div className="space-y-2.5 text-xs" style={{ color: "#334155" }}>
            <div>
              <p className="font-medium">1. Chi sono i protagonisti principali del romanzo?</p>
              <p className="text-[10px] italic" style={{ color: "#94A3B8" }}>(aperta)</p>
            </div>
            <div>
              <p className="font-medium">2. In quale periodo storico è ambientata la storia?</p>
              <p className="text-[10px] italic" style={{ color: "#94A3B8" }}>(scelta multipla)</p>
              <div className="flex gap-3 mt-1 text-[11px]" style={{ color: "#64748B" }}>
                <span>□ 1300</span>
                <span>□ 1500</span>
                <span>□ 1600</span>
                <span>□ 1800</span>
              </div>
            </div>
            <p className="text-[10px]" style={{ color: "#94A3B8" }}>…</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
              style={{ border: "1px solid #E2E8F0", color: "#64748B" }}
            >
              Modifica
            </span>
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: "#0070C0" }}
            >
              Conferma e assegna
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
