import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18nConfig";
import { translateBatch } from "@/hooks/useAutoTranslate";

export type Lang = "it" | "en" | "es" | "fr" | "de" | "ar";

const SUPPORTED_STATIC = ["it", "en"];

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | null>(null);

// Persist translated bundles in localStorage
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

export function LangProvider({ children }: { children: ReactNode }) {
  const { t: i18nT, i18n } = useTranslation();

  const [currentLang, setCurrentLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("preferred_language") || i18n.language;
    return (["it", "en", "es", "fr", "de", "ar"].includes(stored) ? stored : "it") as Lang;
  });

  const [dynamicBundle, setDynamicBundle] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  // When language changes, update i18next for IT/EN or load dynamic bundle
  useEffect(() => {
    localStorage.setItem("preferred_language", currentLang);
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

    if (SUPPORTED_STATIC.includes(currentLang)) {
      i18n.changeLanguage(currentLang);
      setDynamicBundle({});
      return;
    }

    // For other languages, check cache first
    i18n.changeLanguage("it"); // fallback to IT for i18next
    const cached = getCachedBundle(currentLang);
    if (cached) {
      setDynamicBundle(cached);
      return;
    }

    // Translate all IT keys via Google Translate
    const itBundle = i18n.getResourceBundle("it", "translation") as Record<string, string>;
    if (!itBundle) return;

    const keys = Object.keys(itBundle);
    const texts = keys.map((k) => itBundle[k]);

    setTranslating(true);

    // Translate in chunks of 100
    const chunkSize = 100;
    const translateAll = async () => {
      const result: Record<string, string> = {};
      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunkTexts = texts.slice(i, i + chunkSize);
        const chunkKeys = keys.slice(i, i + chunkSize);
        const translated = await translateBatch(chunkTexts, currentLang);
        chunkKeys.forEach((key, idx) => {
          result[key] = translated[idx] || itBundle[key];
        });
      }
      setDynamicBundle(result);
      setCachedBundle(currentLang, result);
      setTranslating(false);
    };

    translateAll().catch(() => setTranslating(false));
  }, [currentLang, i18n]);

  const setLang = useCallback((newLang: Lang) => {
    setCurrentLang(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (SUPPORTED_STATIC.includes(currentLang)) {
        return i18nT(key);
      }
      // For dynamic languages, check bundle
      if (dynamicBundle[key]) return dynamicBundle[key];
      // Fallback to IT
      return i18nT(key);
    },
    [currentLang, dynamicBundle, i18nT]
  );

  return (
    <LangContext.Provider value={{ lang: currentLang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};
