// ═══════════════════════════════════════════════════════════════
// DAILY OPENING — Momento di apertura giornaliera dello studente
// REGOLE:
// • Appare UNA SOLA VOLTA al giorno, al primo accesso.
// • Il testo grezzo NON viene mai salvato, né mostrato a docente/genitore.
// • Solo il "tone" calibrato (heavy|neutral|positive) viene tenuto in
//   sessionStorage e usato dal Coach per la sola giornata corrente.
// • Saltare = zero conseguenze, nessun segnale negativo.
// ═══════════════════════════════════════════════════════════════

const DATE_KEY = "inschool-daily-opening-date";
const TONE_KEY = "inschool-daily-opening-tone";

export const DAILY_OPENING_PROMPT = "Prima di iniziare, se vuoi, puoi dirmi qualcosa.";

export type DailyOpeningTone = "heavy" | "neutral" | "positive";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function shouldShowDailyOpening(): boolean {
  try {
    return localStorage.getItem(DATE_KEY) !== todayISO();
  } catch {
    return false;
  }
}

export function markDailyOpeningDone() {
  try {
    localStorage.setItem(DATE_KEY, todayISO());
  } catch {}
}

export function setDailyOpeningTone(tone: DailyOpeningTone) {
  try {
    sessionStorage.setItem(TONE_KEY, tone);
  } catch {}
}

export function getDailyOpeningTone(): DailyOpeningTone | null {
  try {
    const v = sessionStorage.getItem(TONE_KEY);
    if (v === "heavy" || v === "neutral" || v === "positive") return v;
    return null;
  } catch {
    return null;
  }
}

export function clearDailyOpeningTone() {
  try {
    sessionStorage.removeItem(TONE_KEY);
  } catch {}
}

/**
 * Analizza il testo del momento di apertura.
 * Il testo viene inviato all'edge function ma NON viene mai persistito.
 * Restituisce solo il tono calibrato.
 */
export async function analyzeOpeningTone(text: string): Promise<DailyOpeningTone> {
  if (!text || text.trim().length === 0) return "neutral";
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("analyze-opening-tone", {
      body: { text },
    });
    if (error) return "neutral";
    const tone = (data as any)?.tone;
    if (tone === "heavy" || tone === "positive" || tone === "neutral") return tone;
    return "neutral";
  } catch {
    return "neutral";
  }
}

// ─── Backward-compat shim per il vecchio check-in ──────────────
// Mantiene shouldShowCheckin / markCheckinDone in vita per non
// rompere import esistenti, mappandoli sul nuovo flusso.
export const shouldShowCheckin = shouldShowDailyOpening;
export const markCheckinDone = markDailyOpeningDone;
