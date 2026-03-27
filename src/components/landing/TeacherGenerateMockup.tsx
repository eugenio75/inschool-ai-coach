import { BrowserFrame } from "./BrowserFrame";
import { Sparkles } from "lucide-react";

export function TeacherGenerateMockup() {
  return (
    <BrowserFrame>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5" style={{ color: "#0070C0" }} />
        <p className="text-[16px] font-bold" style={{ color: "#1A3A5C" }}>
          Genera con AI
        </p>
      </div>

      {/* Form */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] font-semibold" style={{ color: "#94A3B8" }}>
            Tipo:
          </span>
          <span
            className="text-[12px] font-medium rounded-full px-3 py-1"
            style={{ backgroundColor: "rgba(0,112,192,0.1)", color: "#0070C0" }}
          >
            Verifica
          </span>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: "#334155" }}>
          "Verifica sui Promessi Sposi, terza media, 8 domande, difficoltà media"
        </p>
        <div className="flex justify-end mt-3">
          <span
            className="rounded-lg px-5 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: "#0070C0" }}
          >
            Genera →
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-4" />

      {/* Preview */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#94A3B8" }}>
          Anteprima generata
        </p>
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "#FAFAFA", border: "1px solid #E2E8F0" }}
        >
          <p className="text-[15px] font-bold" style={{ color: "#1A3A5C" }}>
            Verifica — I Promessi Sposi
          </p>

          <div className="space-y-3 mt-3 text-[13px]" style={{ color: "#334155" }}>
            <div>
              <p className="font-medium">1. Chi sono i protagonisti?</p>
              <p className="text-[11px] italic" style={{ color: "#94A3B8" }}>(aperta)</p>
            </div>
            <div>
              <p className="font-medium">2. In che periodo è ambientata?</p>
              <div className="flex gap-3 mt-1.5 text-[12px]" style={{ color: "#64748B" }}>
                <span>□ 1300</span>
                <span>□ 1500</span>
                <span
                  className="font-medium"
                  style={{ color: "#0070C0" }}
                >
                  ● 1600
                </span>
                <span>□ 1800</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <span
              className="rounded-lg px-4 py-2 text-[12px] font-medium"
              style={{ border: "1px solid #E2E8F0", color: "#64748B" }}
            >
              Modifica
            </span>
            <span
              className="rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
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
