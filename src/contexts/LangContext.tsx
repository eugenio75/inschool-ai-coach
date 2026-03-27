import { createContext, useContext, useCallback, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18nConfig";

export type Lang = "it" | "en";

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();

  const lang = (i18n.language === "en" ? "en" : "it") as Lang;

  const setLang = useCallback(
    (newLang: Lang) => {
      i18n.changeLanguage(newLang);
    },
    [i18n]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};
