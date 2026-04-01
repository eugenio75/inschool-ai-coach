import { useState, useRef, useEffect } from "react";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface SchoolResult {
  codice_meccanografico: string;
  denominazione: string;
  comune: string;
  provincia: string;
  tipo_scuola: string;
}

interface SchoolAutocompleteProps {
  value: string;
  onChange: (name: string, code: string | null, city: string) => void;
  placeholder?: string;
  className?: string;
  cityFilter?: string;
}

// Only expand full words → abbreviations, never the reverse
const CONTRACTION_MAP: [RegExp, string][] = [
  [/istituto comprensivo/i, "IC"],
  [/liceo scientifico/i, "LS"],
  [/istituto tecnico/i, "ITIS"],
  [/istituto professionale/i, "IPSIA"],
  [/liceo classico/i, "LC"],
  [/liceo linguistico/i, "LL"],
  [/liceo artistico/i, "LA"],
  [/scuola primaria/i, "SP"],
  [/elementare/i, "SP"],
  [/scuola media/i, "SM"],
  [/secondaria/i, "SM"],
];

function getExpandedQueries(query: string): string[] {
  const trimmed = query.trim();
  const queries = new Set<string>([trimmed]);

  for (const [pattern, abbr] of CONTRACTION_MAP) {
    if (pattern.test(trimmed)) {
      queries.add(trimmed.replace(pattern, abbr));
    }
  }

  return Array.from(queries);
}

export function SchoolAutocomplete({ value, onChange, placeholder, className, cityFilter }: SchoolAutocompleteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setSelectedCode(null);
    onChange(val, null, "");

    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const expandedQueries = getExpandedQueries(trimmed);

        const searches = expandedQueries.map((q) => {
          const rpcArgs: any = { query: q, limit_n: 10 };
          if (cityFilter) rpcArgs.city_filter = cityFilter;
          return supabase.rpc("search_schools", rpcArgs);
        });

        const responses = await Promise.all(searches);

        // Merge and deduplicate by codice_meccanografico
        const seen = new Set<string>();
        const merged: SchoolResult[] = [];
        for (const { data, error } of responses) {
          if (!error && data) {
            for (const s of data as SchoolResult[]) {
              if (!seen.has(s.codice_meccanografico)) {
                seen.add(s.codice_meccanografico);
                merged.push(s);
              }
            }
          }
        }

        setResults(merged.slice(0, 15));
        setShowDropdown(true);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
  };

  const selectSchool = (school: SchoolResult) => {
    setQuery(school.denominazione);
    setSelectedCode(school.codice_meccanografico);
    setShowDropdown(false);
    onChange(school.denominazione, school.codice_meccanografico, school.comune || "");
  };

  const inputClass = className || "w-full p-4 rounded-xl border border-border bg-muted/50 outline-none focus:border-primary text-foreground";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder || t("school_search_placeholder")}
          className={`${inputClass} pr-10`}
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-md max-h-48 overflow-y-auto">
          {results.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectSchool(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors text-sm flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{s.denominazione}</p>
                <p className="text-xs text-muted-foreground">
                  {s.comune}{s.provincia ? ` (${s.provincia})` : ""}
                  {s.tipo_scuola ? ` · ${s.tipo_scuola}` : ""}
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selectedCode && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-xs">🟡</span>
          <span className="text-xs text-amber-600 font-medium">{t("school_recognized")}</span>
        </div>
      )}
      {query.length >= 2 && !selectedCode && !searching && results.length === 0 && showDropdown && (
        <p className="text-xs text-muted-foreground mt-1.5 px-1">{t("school_not_found_hint")}</p>
      )}
      {query.length >= 2 && !selectedCode && !searching && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-xs">⚪</span>
          <span className="text-xs text-muted-foreground">{t("school_not_verified")}</span>
        </div>
      )}
    </div>
  );
}
