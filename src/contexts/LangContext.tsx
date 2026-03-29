import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18nConfig";
import { supabase } from "@/integrations/supabase/client";

export type Lang = "it" | "en" | "es" | "fr" | "de" | "ar";

const SUPPORTED_STATIC = ["it", "en"];

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  translating: boolean;
}

const LangContext = createContext<LangContextType | null>(null);

// LocalStorage cache for fast load
function getCachedBundle(lang: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`inschool_i18n_${lang}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedBundle(lang: string, bundle: Record<string, string>) {
  try {
    localStorage.setItem(`inschool_i18n_${lang}`, JSON.stringify(bundle));
  } catch {}
}

async function loadFromSupabase(lang: string): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase
      .from("translation_cache")
      .select("key, value")
      .eq("lang", lang);
    if (error || !data?.length) return null;
    const bundle: Record<string, string> = {};
    data.forEach((row: any) => { bundle[row.key] = row.value; });
    return bundle;
  } catch {
    return null;
  }
}

async function saveToSupabase(lang: string, bundle: Record<string, string>) {
  try {
    const rows = Object.entries(bundle).map(([key, value]) => ({
      lang, key, value, updated_at: new Date().toISOString(),
    }));
    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from("translation_cache").upsert(rows.slice(i, i + 100), {
        onConflict: "lang,key",
      });
    }
  } catch (err) {
    console.debug("[i18n] Failed to save to Supabase:", err);
  }
}

async function translateViaEdgeFunction(
  texts: string[],
  keys: string[],
  targetLang: string
): Promise<string[]> {
  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-batch`;
  const chunkSize = 80;
  const allTranslations: string[] = [];

  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunkTexts = texts.slice(i, i + chunkSize);
    const chunkKeys = keys.slice(i, i + chunkSize);

    try {
      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ texts: chunkTexts, keys: chunkKeys, targetLang, sourceLang: "it" }),
      });

      if (!res.ok) {
        console.warn("[i18n] Translation API error:", res.status);
        allTranslations.push(...chunkTexts);
        continue;
      }

      const data = await res.json();
      allTranslations.push(...(data.translations || chunkTexts));
    } catch {
      allTranslations.push(...chunkTexts);
    }
  }

  return allTranslations;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const { t: i18nT, i18n } = useTranslation();

  const [currentLang, setCurrentLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("preferred_language") || i18n.language;
    return (["it", "en", "es", "fr", "de", "ar"].includes(stored) ? stored : "it") as Lang;
  });

  const [dynamicBundle, setDynamicBundle] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    localStorage.setItem("preferred_language", currentLang);
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

    if (SUPPORTED_STATIC.includes(currentLang)) {
      i18n.changeLanguage(currentLang);
      setDynamicBundle({});
      return;
    }

    // For other languages: cache → Supabase → AI translation
    i18n.changeLanguage("it");

    const cached = getCachedBundle(currentLang);
    if (cached && Object.keys(cached).length > 10) {
      setDynamicBundle(cached);
      return;
    }

    const itBundle = i18n.getResourceBundle("it", "translation") as Record<string, string>;
    if (!itBundle) return;

    const loadTranslations = async () => {
      setTranslating(true);

      // Try Supabase first
      const supabaseBundle = await loadFromSupabase(currentLang);
      if (supabaseBundle && Object.keys(supabaseBundle).length > 10) {
        setDynamicBundle(supabaseBundle);
        setCachedBundle(currentLang, supabaseBundle);
        setTranslating(false);

        // Check for new keys
        const itKeys = Object.keys(itBundle);
        const missingKeys = itKeys.filter((k) => !supabaseBundle[k]);
        if (missingKeys.length > 0) {
          const missingTexts = missingKeys.map((k) => itBundle[k]);
          const translated = await translateViaEdgeFunction(missingTexts, missingKeys, currentLang);
          const newEntries: Record<string, string> = {};
          missingKeys.forEach((k, i) => { newEntries[k] = translated[i]; });
          const fullBundle = { ...supabaseBundle, ...newEntries };
          setDynamicBundle(fullBundle);
          setCachedBundle(currentLang, fullBundle);
          saveToSupabase(currentLang, newEntries);
        }
        return;
      }

      // Full translation via AI
      const keys = Object.keys(itBundle);
      const texts = keys.map((k) => itBundle[k]);
      const translated = await translateViaEdgeFunction(texts, keys, currentLang);

      const result: Record<string, string> = {};
      keys.forEach((key, idx) => {
        result[key] = translated[idx] || itBundle[key];
      });

      setDynamicBundle(result);
      setCachedBundle(currentLang, result);
      saveToSupabase(currentLang, result);
      setTranslating(false);
    };

    loadTranslations().catch(() => setTranslating(false));
  }, [currentLang, i18n]);

  const setLang = useCallback((newLang: Lang) => {
    setCurrentLang(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (SUPPORTED_STATIC.includes(currentLang)) {
        return i18nT(key);
      }
      if (dynamicBundle[key]) return dynamicBundle[key];
      return i18nT(key);
    },
    [currentLang, dynamicBundle, i18nT]
  );

  return (
    <LangContext.Provider value={{ lang: currentLang, setLang, t, translating }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};
