import { BrowserFrame } from "./BrowserFrame";
import { AlertTriangle } from "lucide-react";

function StrengthBar({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="w-3 h-2 rounded-sm"
          style={{ backgroundColor: i < filled ? "#0070C0" : "#E2E8F0" }}
        />
      ))}
    </div>
  );
}

interface TopicRow {
  name: string;
  filled: number;
  warn?: boolean;
}

function SubjectBlock({ subject, topics }: { subject: string; topics: TopicRow[] }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold mb-2" style={{ color: "#1A3A5C" }}>
        {subject}
      </p>
      <div className="space-y-2">
        {topics.map((t) => (
          <div key={t.name} className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "#334155" }}>
              {t.name}
            </span>
            <div className="flex items-center gap-1.5">
              <StrengthBar filled={t.filled} total={5} />
              {t.warn && (
                <span
                  className="flex items-center gap-0.5 text-[9px] font-medium rounded px-1 py-0.5"
                  style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                >
                  <AlertTriangle className="w-2.5 h-2.5" /> da rinforzare
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentReviewMockup() {
  return (
    <BrowserFrame>
      <p className="text-sm font-bold mb-1" style={{ color: "#1A3A5C" }}>
        Ripassa
      </p>
      <p className="text-[10px] mb-4" style={{ color: "#94A3B8" }}>
        Questa settimana
      </p>

      <SubjectBlock
        subject="Matematica"
        topics={[
          { name: "Espressioni algebriche", filled: 4 },
          { name: "Frazioni", filled: 2, warn: true },
        ]}
      />
      <SubjectBlock
        subject="Italiano"
        topics={[
          { name: "Analisi del testo", filled: 5 },
          { name: "Grammatica", filled: 3 },
        ]}
      />
    </BrowserFrame>
  );
}
