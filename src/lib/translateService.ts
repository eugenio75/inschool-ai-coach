/**
 * Direct OpenAI translation service — no edge function dependency.
 * Uses VITE_OPENAI_API_KEY from env for gpt-4o-mini translations.
 */

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

const langNames: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  ar: "Arabic",
  en: "English",
  it: "Italian",
};

export async function translateBundle(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  if (!OPENAI_KEY || !texts.length) return texts;

  const targetName = langNames[targetLang] || targetLang;
  const chunkSize = 60;
  const result: string[] = [];

  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `Translate these Italian UI strings to ${targetName}. Return ONLY a JSON array of strings, same order, same length. Keep "InSchool" untranslated. Keep placeholders like {{name}} unchanged. Keep HTML tags unchanged. Keep short and concise.`,
            },
            { role: "user", content: JSON.stringify(chunk) },
          ],
        }),
      });

      if (!res.ok) {
        console.warn("[i18n] OpenAI error:", res.status);
        result.push(...chunk);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed: string[] = JSON.parse(match[0]);
        // Ensure same length
        for (let j = 0; j < chunk.length; j++) {
          result.push(parsed[j] ?? chunk[j]);
        }
      } else {
        result.push(...chunk);
      }
    } catch (err) {
      console.warn("[i18n] Translation chunk failed:", err);
      result.push(...chunk);
    }
  }

  return result;
}

export function getCached(lang: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`inschool_i18n_${lang}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - (p.__ts || 0) > 86400000) return null; // 24h TTL
    delete p.__ts;
    return p;
  } catch {
    return null;
  }
}

export function setCache(lang: string, bundle: Record<string, string>) {
  try {
    localStorage.setItem(
      `inschool_i18n_${lang}`,
      JSON.stringify({ ...bundle, __ts: Date.now() })
    );
  } catch {}
}
