import { useState, useEffect, useRef } from "react";

const GOOGLE_TRANSLATE_API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;

const translationCache: Record<string, Record<string, string>> = {};

export function useAutoTranslate(text: string, targetLang: string): string {
  const [translated, setTranslated] = useState(text);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!text || !targetLang || targetLang === "it") {
      setTranslated(text);
      return;
    }

    // Check cache
    const cacheKey = `${targetLang}:${text}`;
    if (translationCache[targetLang]?.[text]) {
      setTranslated(translationCache[targetLang][text]);
      return;
    }

    if (!GOOGLE_TRANSLATE_API_KEY) {
      setTranslated(text);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const doTranslate = async () => {
      try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, target: targetLang, source: "it", format: "text" }),
          signal: controller.signal,
        });
        const data = await response.json();
        const result = data?.data?.translations?.[0]?.translatedText || text;

        if (!translationCache[targetLang]) translationCache[targetLang] = {};
        translationCache[targetLang][text] = result;
        setTranslated(result);
      } catch (err: any) {
        if (err.name !== "AbortError") setTranslated(text);
      }
    };

    doTranslate();
    return () => controller.abort();
  }, [text, targetLang]);

  return translated;
}

/** Batch translate multiple texts at once */
export async function translateBatch(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  if (!GOOGLE_TRANSLATE_API_KEY || !texts.length || targetLang === "it") return texts;

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, target: targetLang, source: "it", format: "text" }),
    });
    const data = await response.json();
    return data?.data?.translations?.map((t: any) => t.translatedText) || texts;
  } catch {
    return texts;
  }
}
