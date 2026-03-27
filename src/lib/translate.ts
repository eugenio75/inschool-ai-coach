/**
 * Google Translate API utility for dynamic AI-generated content.
 * Static UI strings should use the i18n JSON files instead.
 */

const GOOGLE_TRANSLATE_API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;

export async function translateText(
  text: string,
  targetLang: "it" | "en",
  sourceLang?: "it" | "en"
): Promise<string> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn("Google Translate API key not configured");
    return text;
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: sourceLang || "auto",
      format: "text",
    }),
  });

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

export async function detectLanguage(text: string): Promise<string> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn("Google Translate API key not configured");
    return "it";
  }

  const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_TRANSLATE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text }),
  });

  const data = await response.json();
  return data.data.detections[0][0].language;
}
