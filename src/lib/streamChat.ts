import { supabase } from "@/integrations/supabase/client";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            onDelta(fullText);
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  }

  onDone(fullText);
  return fullText;
}
