import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import it from "@/locales/it.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

// Migrate old localStorage key
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
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ar: { translation: ar },
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

// Set document lang attribute
document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem("preferred_language", lng);
});

export default i18n;
