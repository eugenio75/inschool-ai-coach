import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import it from "@/locales/it.json";
import en from "@/locales/en.json";

try {
  const oldKey = localStorage.getItem("inschool_lang");
  if (oldKey && !localStorage.getItem("preferred_language")) {
    localStorage.setItem("preferred_language", oldKey);
  }
  localStorage.removeItem("inschool_lang");
} catch {}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
    },
    fallbackLng: "it",
    supportedLngs: ["it", "en", "es", "fr", "de", "ar"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "preferred_language",
      caches: ["localStorage"],
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith("it")) return "it";
        if (lng.startsWith("en")) return "en";
        if (lng.startsWith("es")) return "es";
        if (lng.startsWith("fr")) return "fr";
        if (lng.startsWith("de")) return "de";
        if (lng.startsWith("ar")) return "ar";
        return "it";
      },
    },
    react: { useSuspense: false },
  });

// Lazy load other languages on demand
export async function loadLanguage(lang: string) {
  if (["it", "en"].includes(lang)) return;
  if (i18n.hasResourceBundle(lang, "translation")) return;
  
  const bundles: Record<string, () => Promise<any>> = {
    es: () => import("@/locales/es.json"),
    fr: () => import("@/locales/fr.json"),
    de: () => import("@/locales/de.json"),
    ar: () => import("@/locales/ar.json"),
  };
  
  if (bundles[lang]) {
    const module = await bundles[lang]();
    i18n.addResourceBundle(lang, "translation", module.default || module, true, true);
  }
}

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem("preferred_language", lng);
  loadLanguage(lng);
});

export default i18n;
