import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import it from "@/locales/it.json";
import en from "@/locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
    },
    fallbackLng: "it",
    supportedLngs: ["it", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "preferred_language",
      caches: ["localStorage"],
      convertDetectedLanguage: (lng: string) => (lng.startsWith("it") ? "it" : "en"),
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
