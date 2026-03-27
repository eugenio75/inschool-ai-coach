import i18n from "@/lib/i18nConfig";

/** Returns the current i18n language code for passing to edge functions */
export function getCurrentLang(): string {
  return i18n.language?.startsWith("en") ? "en" : "it";
}
