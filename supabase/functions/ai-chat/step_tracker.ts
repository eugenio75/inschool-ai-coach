export interface ExerciseStep {
  stepIndex: number;
  expectedAnswer: string;
  attemptCount: number;
  maxAttempts: number;
  solved: boolean;
}

export interface SessionState {
  inExercise: boolean;
  currentStep: ExerciseStep | null;
  completedSteps: ExerciseStep[];
  subject: string;
  topic: string;
}

export function parseSessionState(messages: any[]): SessionState {
  const state: SessionState = {
    inExercise: false,
    currentStep: null,
    completedSteps: [],
    subject: "",
    topic: "",
  };

  let stepIndex = 0;
  let attemptCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = (msg.content || "").toLowerCase();

    if (msg.role === "assistant") {
      // Inizia esercizio
      if (/\[colonna:.*parziale=true/i.test(msg.content || "")) {
        state.inExercise = true;
      }

      // Fine esercizio
      if (/abbiamo finito|completato|risultato finale/i.test(text)) {
        state.inExercise = false;
        state.currentStep = null;
      }

      // Conferma risposta corretta
      if (
        /esatto|perfetto|bravo|corretto|giusto|✅/i.test(text) &&
        !/non è corretto|sbagliato/i.test(text)
      ) {
        if (state.currentStep) {
          state.completedSteps.push({ ...state.currentStep, solved: true });
        }
        stepIndex++;
        attemptCount = 0;
        state.currentStep = null;
      }
    }

    if (msg.role === "user" && state.inExercise) {
      attemptCount++;
    }
  }

  // Se siamo in esercizio ma senza step corrente, creane uno
  if (state.inExercise && !state.currentStep) {
    state.currentStep = {
      stepIndex,
      expectedAnswer: "",
      attemptCount,
      maxAttempts: 4,
      solved: false,
    };
  }

  return state;
}

export function extractExpectedAnswer(
  mathContext: string,
  stepIndex: number
): string {
  const lines = mathContext.split("\n");
  const stepLine = lines.find((l) =>
    l.toLowerCase().includes(`passo ${stepIndex + 1}`)
  );

  if (!stepLine) return "";

  // Estrai "ci sta X volte"
  const match = stepLine.match(/ci sta (\d+) volte/);
  if (match) return match[1];

  // Estrai prodotto "X×Y=Z"
  const prodMatch = stepLine.match(/=(\d+),/);
  if (prodMatch) return prodMatch[1];

  return "";
}
