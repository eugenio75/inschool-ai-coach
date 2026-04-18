import { supabase } from "@/integrations/supabase/client";
import i18n from "i18next";
import { getDailyOpeningTone } from "@/lib/dailyOpening";
import { pullPendingTrigger, markAssistantTurn } from "@/lib/relationalMoments";
import { getCurrentSessionSnapshot, getOpeningToneStreak, recordRelationalOffered } from "@/lib/behavioralProfile";

export interface ChatAction {
  label: string;
  icon?: string; // emoji
  value: string;
  primary?: boolean;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
}

/**
 * Simulate streaming by revealing text character by character.
 */
function streamSimulated(
  text: string,
  onChunk: (partial: string) => void,
  onComplete: () => void,
  msPerChar = 15
) {
  let i = 0;
  const interval = setInterval(() => {
    i += Math.floor(Math.random() * 3) + 1;
    if (i >= text.length) {
      onChunk(text);
      onComplete();
      clearInterval(interval);
    } else {
      onChunk(text.substring(0, i));
    }
  }, msPerChar);
}

/**
 * Stream a chat response from ai-chat edge function.
 * Returns the full assembled text.
 */
export async function streamChat({
  messages,
  onDelta,
  onDone,
  extraBody = {},
}: {
  messages: ChatMsg[];
  onDelta: (fullSoFar: string) => void;
  onDone: (fullText: string) => void;
  extraBody?: Record<string, any>;
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        lang: i18n.language || "it",
        // Tono dell'apertura giornaliera (heavy|neutral|positive). Solo runtime,
        // mai persistito. Il Coach lo usa per calibrare il registro della sessione.
        daily_opening_tone: getDailyOpeningTone() || undefined,
        // Momento relazionale contestuale (max 1 per sessione). Solo etichetta,
        // mai testo dell'utente. Il Coach lo intreccia naturalmente nella risposta.
        relational_trigger: (() => {
          const t = pullPendingTrigger() || undefined;
          if (t) recordRelationalOffered();
          return t;
        })(),
        // Snapshot comportamentale corrente (solo conteggi anonimi, mai testi)
        // — usato per aggiornare il profilo adattivo a fine sessione.
        behavioral_snapshot: getCurrentSessionSnapshot() || undefined,
        // Streak del tono di apertura ultimi 14 giorni (solo conteggi).
        opening_tone_streak: getOpeningToneStreak(),
        ...extraBody,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || "Errore AI");
    } catch {
      throw new Error("Errore AI");
    }
  }

  // Check if this is a validated (non-streaming) response
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data.validated && data.choices?.[0]?.message?.content) {
      const fullText = data.choices[0].message.content;
      // Simulate streaming with typewriter effect
      return new Promise<string>((resolve) => {
        streamSimulated(
          fullText,
          onDelta,
          () => {
            onDone(fullText);
            markAssistantTurn();
            resolve(fullText);
          }
        );
      });
    }
    // Regular non-streaming response
    const fullText = data.choices?.[0]?.message?.content || "";
    if (!fullText.trim()) {
      console.warn("[streamChat] Empty AI response (JSON path), retrying once...");
      // Retry once
      const retryRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: false,
            lang: i18n.language || "it",
            ...extraBody,
          }),
        }
      );
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const retryText = retryData.choices?.[0]?.message?.content || "";
        if (retryText.trim()) {
          onDelta(retryText);
          onDone(retryText);
          markAssistantTurn();
          return retryText;
        }
      }
      // Still empty — return a fallback message
      const fallback = "Mi scuso, ho avuto un momento di distrazione! 😅 Puoi ripetere o riformulare la tua risposta?";
      onDelta(fallback);
      onDone(fallback);
      markAssistantTurn();
      return fallback;
    }
    onDelta(fullText);
    onDone(fullText);
    markAssistantTurn();
    return fullText;
  }

  // Normal SSE streaming path
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  // Tokens that indicate raw SSE metadata — never show to user
  const RAW_BLACKLIST = ["chatcmpl", "logprobs", "finish_reason", "system_fingerprint", "obfuscation"];

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        // Skip empty lines
        if (!line.trim()) continue;

        // Only process SSE "data:" lines
        if (!line.startsWith("data:")) continue;

        const jsonStr = line.slice(5).trim();

        // Skip SSE terminator
        if (jsonStr === "[DONE]") continue;

        // Skip lines containing raw metadata tokens
        if (RAW_BLACKLIST.some(tok => jsonStr.includes(tok) && !jsonStr.includes('"content"'))) {
          // Still try to extract content from valid JSON
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            onDelta(fullText);
          }
          // Silently skip chunks with no content (metadata-only)
        } catch {
          // If we can't parse, check if it's a partial chunk — hold in buffer
          // But NEVER pass raw SSE to the UI
          if (jsonStr.startsWith("{")) {
            buffer = line + "\n" + buffer;
            break;
          }
          // Otherwise discard the unparseable line entirely
        }
      }
    }
  }

  // Guard against empty streaming result
  if (!fullText.trim()) {
    console.warn("[streamChat] Empty AI response (SSE path)");
    const fallback = "Mi scuso, ho avuto un momento di distrazione! 😅 Puoi ripetere o riformulare la tua risposta?";
    onDelta(fallback);
    onDone(fallback);
    return fallback;
  }

  onDone(fullText);
  markAssistantTurn();
  return fullText;
}
