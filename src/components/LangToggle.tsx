import { useLang, Lang } from "@/contexts/LangContext";
import { ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

const languages: { code: Lang; flag: string; label: string }[] = [
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "ar", flag: "🇸🇦", label: "العربية" },
];

export function LangToggle() {
  const { lang, setLang, translating } = useLang();
  const [open, setOpen] = useState(false);
  const current = languages.find((l) => l.code === lang) || languages[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex min-w-[84px] items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-accent hover:text-accent-foreground">
          <span className="text-base leading-none">{current.flag}</span>
          <span className="text-xs font-semibold tracking-wide">{current.code.toUpperCase()}</span>
          <span className="flex items-center gap-1">
            {translating && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => {
              setLang(l.code);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              lang === l.code
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
