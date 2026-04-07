import { supabase } from "@/integrations/supabase/client";
import i18n from "i18next";

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

  onDone(fullText);
  return fullText;
}
