// ════════════════════════════════════════════════════════════════════════
// RELATIONAL MOMENTS — momenti relazionali contestuali in sessione
// ════════════════════════════════════════════════════════════════════════
// Filosofia (NON è un check-in, NON è una domanda diretta sullo stato emotivo):
//   • Il Coach NON chiede mai "come stai?".
//   • Nota cosa accade nella sessione e apre uno spazio breve e naturale.
//   • Lo studente può rispondere, ignorare o continuare — tutte risposte
//     ugualmente valide.
//
// Tre trigger comportamentali (max UNO per sessione):
//   1) repeated_error  → 3+ errori sullo stesso punto
//   2) slowdown        → tempo di risposta 2× la media personale
//   3) high_performance→ punteggio molto sopra la media personale
//
// Privacy:
//   • Il messaggio relazionale è solo nella session corrente.
//   • L'eventuale risposta dello studente NON viene salvata come testo
//     grezzo, NON è mai mostrata al docente.
//   • Solo il "tono" derivato calibra il resto della sessione.
// ════════════════════════════════════════════════════════════════════════

export type RelationalTrigger = "repeated_error" | "slowdown" | "high_performance";

const SESSION_KEY = "inschool-relational-session";

type SessionState = {
  sessionId: string;          // identifies "current session"
  triggerFired: RelationalTrigger | null;  // max 1 per session
  // signals
  errorPoints: Record<string, number>;     // errors per "point" (e.g. step or topic)
  lastUserAt?: number;                     // timestamp of last user message
  responseTimes: number[];                 // ms between assistant→user pairs (personal avg proxy)
  scores: number[];                        // recent scores in this session
};

function readState(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch { return null; }
}

function writeState(s: SessionState) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { }
}

/** Call once when a new exercise session starts. Resets all signals. */
export function startRelationalSession(sessionId: string) {
  const s: SessionState = {
    sessionId,
    triggerFired: null,
    errorPoints: {},
    responseTimes: [],
    scores: [],
  };
  writeState(s);
}

export function endRelationalSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { }
}

/** Record an error on a specific "point" (a stable key: step number, topic, etc.) */
export function recordError(point: string) {
  const s = readState(); if (!s) return;
  s.errorPoints[point] = (s.errorPoints[point] || 0) + 1;
  writeState(s);
}

/** Mark that the assistant just finished — start measuring the next response time. */
export function markAssistantTurn() {
  const s = readState(); if (!s) return;
  s.lastUserAt = Date.now();
  writeState(s);
}

/** Record a user reply — closes a response-time window. */
export function recordUserTurn() {
  const s = readState(); if (!s) return;
  if (s.lastUserAt) {
    const dt = Date.now() - s.lastUserAt;
    if (dt > 1000 && dt < 1000 * 60 * 30) {
      s.responseTimes.push(dt);
      // keep last 20
      if (s.responseTimes.length > 20) s.responseTimes.shift();
    }
  }
  s.lastUserAt = undefined;
  writeState(s);
}

/** Record a score (0..100) for performance trigger. */
export function recordScore(score: number) {
  const s = readState(); if (!s) return;
  s.scores.push(score);
  if (s.scores.length > 20) s.scores.shift();
  writeState(s);
}

/**
 * Compute the trigger that should fire NOW (or null).
 * Returns null if a trigger has already fired this session (max 1).
 */
export function evaluateTrigger(): RelationalTrigger | null {
  const s = readState(); if (!s) return null;
  if (s.triggerFired) return null;

  // 1) repeated error on same point (3+)
  const maxErr = Math.max(0, ...Object.values(s.errorPoints));
  if (maxErr >= 3) return "repeated_error";

  // 2) slowdown — last response time ≥ 2× rolling avg of previous ones
  if (s.responseTimes.length >= 4) {
    const last = s.responseTimes[s.responseTimes.length - 1];
    const prev = s.responseTimes.slice(0, -1);
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avg > 0 && last >= 2 * avg && last > 15000) return "slowdown";
  }

  // 3) high performance — last score ≥ 25 pts above personal avg of prior scores
  if (s.scores.length >= 3) {
    const last = s.scores[s.scores.length - 1];
    const prev = s.scores.slice(0, -1);
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (last - avg >= 25 && last >= 80) return "high_performance";
  }

  return null;
}

/** Mark the trigger as fired so it never fires again in this session. */
export function consumeTrigger(t: RelationalTrigger) {
  const s = readState(); if (!s) return;
  s.triggerFired = t;
  writeState(s);
}

/**
 * Convenience: evaluate + consume in one shot. Returns the trigger
 * to inject (or null). Call this RIGHT BEFORE sending a message
 * to the AI so the Coach can weave the moment naturally.
 */
export function pullPendingTrigger(): RelationalTrigger | null {
  const t = evaluateTrigger();
  if (t) consumeTrigger(t);
  return t;
}
