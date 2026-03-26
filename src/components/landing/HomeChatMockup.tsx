import { BrowserFrame } from "./BrowserFrame";

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
        className="rounded-2xl rounded-tl-md px-3 py-2 text-xs leading-relaxed"
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
        className="rounded-2xl rounded-tr-md px-3 py-2 text-xs leading-relaxed text-white"
        style={{ backgroundColor: "#0070C0" }}
      >
        {text}
      </div>
    </div>
  );
}

export function HomeChatMockup() {
  return (
    <PhoneFrame>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider mb-3"
        style={{ color: "#94A3B8" }}
      >
        Coach InSchool
      </p>
      <CoachBubble text="Ciao Marco. Oggi hai matematica da finire e italiano per giovedì. Da dove partiamo?" />
      <UserBubble text="Partiamo da matematica" />
      <CoachBubble text="Perfetto. Hai le espressioni algebriche. Prima di iniziare dimmi — hai già visto questo argomento o è la prima volta?" />
      <UserBubble text="Lo conosco già" />
      <CoachBubble text="Bene. Allora chiudiamo il libro e partiamo da quello che ricordi. Cosa sai dirmi sulle espressioni algebriche?" />
      {/* Input bar */}
      <div
        className="mt-3 rounded-full px-3 py-2 flex items-center gap-2 text-xs"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", color: "#94A3B8" }}
      >
        Scrivi un messaggio...
      </div>
    </PhoneFrame>
  );
}
