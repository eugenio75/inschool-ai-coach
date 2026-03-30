import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18nConfig";
import { loadLanguage } from "@/lib/i18nConfig";
import { translateBundle, getCached, setCache } from "@/lib/translateService";

export type Lang = "it" | "en" | "es" | "fr" | "de" | "ar";

const SUPPORTED_STATIC: Lang[] = ["it", "en"];

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  translating: boolean;
}

const LangContext = createContext<LangContextType | null>(null);

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
      await loadLanguage(currentLang);
    i18n.changeLanguage(currentLang);
      setDynamicBundle({});
      return;
    }

    // For dynamic languages, base on Italian
    i18n.changeLanguage("it");

    // Check cache first
    const cached = getCached(currentLang);
    if (cached && Object.keys(cached).length > 10) {
      setDynamicBundle(cached);
      return;
    }

    // Translate via OpenAI
    const itBundle = i18n.getResourceBundle("it", "translation") as Record<string, string>;
    if (!itBundle) return;

    const doTranslate = async () => {
      setTranslating(true);
      try {
        const keys = Object.keys(itBundle);
        const texts = keys.map((k) => itBundle[k]);
        const translated = await translateBundle(texts, currentLang);

        const result: Record<string, string> = {};
        keys.forEach((key, idx) => {
          result[key] = translated[idx] || itBundle[key];
        });

        setDynamicBundle(result);
        setCache(currentLang, result);
      } catch {
        // Fallback to Italian
        setDynamicBundle({});
      } finally {
        setTranslating(false);
      }
    };

    doTranslate();
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
