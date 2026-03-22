import { useLang } from "@/contexts/LangContext";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center bg-muted rounded-lg p-0.5">
      <button
        onClick={() => setLang("it")}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          lang === "it"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        IT
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          lang === "en"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
}
