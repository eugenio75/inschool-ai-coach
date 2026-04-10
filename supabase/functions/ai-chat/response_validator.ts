export function validateTutorResponse(
  responseText: string,
  currentStep: {
    expectedAnswer: string | number;
    attemptCount: number;
    maxAttempts: number;
  } | null
): { valid: boolean; reason: string } {
  if (!currentStep) return { valid: true, reason: "ok" };

  const expected = String(currentStep.expectedAnswer).trim();
  if (!expected) return { valid: true, reason: "ok" };

  const text = responseText.toLowerCase();

  // Se non siamo ancora al limite tentativi, l'AI NON deve rivelare la risposta
  if (currentStep.attemptCount < currentStep.maxAttempts) {
    const patterns = [
      new RegExp(`\\b${expected}\\b`),
      new RegExp(`è ${expected}`),
      new RegExp(`fa ${expected}`),
      new RegExp(`= ${expected}`),
      new RegExp(`risultato.*${expected}`),
      new RegExp(`risposta.*${expected}`),
      new RegExp(`${expected}.*volte`),
      new RegExp(`volte.*${expected}`),
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          reason: `AI revealed answer "${expected}" too early`,
        };
      }
    }
  }

  return { valid: true, reason: "ok" };
}

export function buildRetryPrompt(
  originalPrompt: string,
  _blockedResponse: string,
  expectedAnswer: string,
  attemptCount: number
): string {
  return `${originalPrompt}

[SISTEMA - BLOCCO AUTOMATICO]
La tua risposta precedente conteneva la risposta corretta (${expectedAnswer}) prima che lo studente la trovasse. Questo è vietato.
Riscrivi la risposta SENZA menzionare il numero ${expectedAnswer} in nessun modo.
Dai solo un hint indiretto.
Lo studente è al tentativo ${attemptCount}.`;
}
