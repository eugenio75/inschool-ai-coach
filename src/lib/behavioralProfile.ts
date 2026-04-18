// ════════════════════════════════════════════════════════════════════════
// BEHAVIORAL PROFILE — adaptive learning of the student across sessions
// ════════════════════════════════════════════════════════════════════════
// Filosofia:
//   • Il Coach impara progressivamente lo studente.
//   • Tutto è server-side (user_preferences.adaptive_profile.behavioral).
//   • Lo studente non vede MAI questi parametri.
//   • Il docente vede SOLO una sintesi interpretata in italiano (mai numeri).
//
// Cosa traccia per studente:
//   • Autonomia              — % esercizi senza richiedere aiuti
//   • Resistenza difficoltà  — % completamento sessioni quando difficoltà sale
//   • Ritmo preferito        — durata media + frequenza ultimi 14 giorni
//   • Risposta al feedback   — variazione performance dopo intervento (better/worse/neutral)
//   • Apertura conversazione — risposta ai momenti relazionali (responds/minimal/ignores)
//   • Pattern errore         — concentrato su un topic vs distribuito
//   • Stanchezza             — calo performance a fine sessione / dopo errori
//
// Quattro fasi (basate su numero sessioni cumulato):
//   1–2    Neutro        → osservare, registro standard, nessun adattamento
//   3–5    Osservazione  → primi pattern, inizio adattamento di tono e timing
//   6–10   Calibrazione  → adattamento attivo su tutti i parametri
//   11+    Consolidato   → profilo stabile, aggiorna solo se cambiamento netto
//
// Privacy:
//   • Le risposte ai momenti relazionali non sono mai persistite come testo.
//   • Solo conteggi anonimi (responds_count, ignored_count, ...).
//   • La sintesi al docente è generata da queste etichette, mai dai dati grezzi.
// ════════════════════════════════════════════════════════════════════════

const SESSION_KEY = "inschool-behavioral-session";

export type RelationalResponseClass = "responds" | "minimal" | "ignores";
export type FeedbackResponseClass = "better" | "worse" | "neutral";
export type BehavioralPhase = "neutro" | "osservazione" | "calibrazione" | "consolidato";

/**
 * Per-session counters held in sessionStorage. Flushed at session end
 * to user_preferences.adaptive_profile.behavioral via the Edge Function.
 */
type SessionCounters = {
  sessionId: string;
  startedAt: number;
  // Hints / autonomy
  exercisesAttempted: number;
  hintRequests: number;
  // Errors
  totalErrors: number;
  errorTopics: Record<string, number>;     // errors per topic key
  errorsAtStart: number;                   // first third
  errorsAtEnd: number;                     // last third
  // Difficulty resistance
  difficultyIncreases: number;             // times difficulty went up
  completedAfterIncrease: boolean;
  // Timing
  responseTimes: number[];                 // ms between assistant→user
  // Scoring
  scores: number[];
  startBaseline?: number;                  // first score
  endBaseline?: number;                    // last score
  // Feedback response
  scoresBeforeIntervention: number[];
  scoresAfterIntervention: number[];
  // Relational openness (mirrored from relationalMoments responses)
  relationalOffered: number;
  relationalResponded: number;
  relationalMinimal: number;
  relationalIgnored: number;
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function readSession(): SessionCounters | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionCounters;
  } catch { return null; }
}

function writeSession(c: SessionCounters) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(c)); } catch { }
}

/** Start a fresh per-session counter bag. Call when a session begins. */
export function startBehavioralSession(sessionId: string) {
  const c: SessionCounters = {
    sessionId,
    startedAt: Date.now(),
    exercisesAttempted: 0,
    hintRequests: 0,
    totalErrors: 0,
    errorTopics: {},
    errorsAtStart: 0,
    errorsAtEnd: 0,
    difficultyIncreases: 0,
    completedAfterIncrease: false,
    responseTimes: [],
    scores: [],
    scoresBeforeIntervention: [],
    scoresAfterIntervention: [],
    relationalOffered: 0,
    relationalResponded: 0,
    relationalMinimal: 0,
    relationalIgnored: 0,
  };
  writeSession(c);
}

export function endBehavioralSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { }
}

// ── Recorders (called from session UI / hooks) ──────────────────────────

export function recordExerciseAttempt() {
  const c = readSession(); if (!c) return;
  c.exercisesAttempted += 1;
  writeSession(c);
}

export function recordHintRequest() {
  const c = readSession(); if (!c) return;
  c.hintRequests += 1;
  writeSession(c);
}

export function recordSessionError(topic?: string) {
  const c = readSession(); if (!c) return;
  c.totalErrors += 1;
  if (topic) {
    const k = topic.trim().toLowerCase();
    c.errorTopics[k] = (c.errorTopics[k] || 0) + 1;
  }
  // Bucket: first third vs last third by exercise count
  if (c.exercisesAttempted <= 2) c.errorsAtStart += 1;
  else c.errorsAtEnd += 1;
  writeSession(c);
}

export function recordSessionScore(score: number) {
  const c = readSession(); if (!c) return;
  c.scores.push(score);
  if (c.startBaseline === undefined) c.startBaseline = score;
  c.endBaseline = score;
  writeSession(c);
}

export function recordResponseTime(ms: number) {
  const c = readSession(); if (!c) return;
  if (ms > 1000 && ms < 1000 * 60 * 30) {
    c.responseTimes.push(ms);
    if (c.responseTimes.length > 50) c.responseTimes.shift();
  }
  writeSession(c);
}

export function recordDifficultyIncrease() {
  const c = readSession(); if (!c) return;
  c.difficultyIncreases += 1;
  writeSession(c);
}

export function markSessionCompletedAfterIncrease() {
  const c = readSession(); if (!c) return;
  c.completedAfterIncrease = true;
  writeSession(c);
}

export function recordScoreBeforeIntervention(score: number) {
  const c = readSession(); if (!c) return;
  c.scoresBeforeIntervention.push(score);
  writeSession(c);
}

export function recordScoreAfterIntervention(score: number) {
  const c = readSession(); if (!c) return;
  c.scoresAfterIntervention.push(score);
  writeSession(c);
}

export function recordRelationalOffered() {
  const c = readSession(); if (!c) return;
  c.relationalOffered += 1;
  writeSession(c);
}

/**
 * Classify the student's response to a relational moment based on
 * length and content — never persists raw text.
 */
export function classifyAndRecordRelationalResponse(replyText: string | null | undefined): RelationalResponseClass {
  const c = readSession();
  const t = (replyText || "").trim();
  let cls: RelationalResponseClass;
  if (!t || t.length === 0) cls = "ignores";
  else if (t.length <= 12) cls = "minimal";
  else cls = "responds";

  if (c) {
    if (cls === "responds") c.relationalResponded += 1;
    else if (cls === "minimal") c.relationalMinimal += 1;
    else c.relationalIgnored += 1;
    writeSession(c);
  }
  return cls;
}

// ── Snapshot for the AI (compact, no raw text) ──────────────────────────

export function getCurrentSessionSnapshot() {
  const c = readSession();
  if (!c) return null;
  const duration = Math.round((Date.now() - c.startedAt) / 1000);
  return {
    sessionId: c.sessionId,
    durationSeconds: duration,
    exercisesAttempted: c.exercisesAttempted,
    hintRequests: c.hintRequests,
    totalErrors: c.totalErrors,
    repeatedTopicMaxErrors: Math.max(0, ...Object.values(c.errorTopics)),
    distinctErrorTopics: Object.keys(c.errorTopics).length,
    errorsAtStart: c.errorsAtStart,
    errorsAtEnd: c.errorsAtEnd,
    avgResponseTimeMs: c.responseTimes.length
      ? Math.round(c.responseTimes.reduce((a, b) => a + b, 0) / c.responseTimes.length)
      : null,
    scoresFirst: c.startBaseline ?? null,
    scoresLast: c.endBaseline ?? null,
    relational: {
      offered: c.relationalOffered,
      responded: c.relationalResponded,
      minimal: c.relationalMinimal,
      ignored: c.relationalIgnored,
    },
  };
}

// ── Phase computation (server uses cumulative sessionCount) ─────────────

export function computePhase(sessionCount: number): BehavioralPhase {
  if (sessionCount <= 2) return "neutro";
  if (sessionCount <= 5) return "osservazione";
  if (sessionCount <= 10) return "calibrazione";
  return "consolidato";
}

// ── Daily-opening tone streak (privacy-safe, only labels) ───────────────

const OPENING_STREAK_KEY = "inschool-opening-tone-streak";

type OpeningStreak = {
  // Last N days of tone labels (rolling 14)
  days: { date: string; tone: "heavy" | "neutral" | "positive" }[];
};

export function recordDailyOpeningToneLocal(tone: "heavy" | "neutral" | "positive") {
  try {
    const raw = localStorage.getItem(OPENING_STREAK_KEY);
    const data: OpeningStreak = raw ? JSON.parse(raw) : { days: [] };
    const today = todayISO();
    // Replace today's entry if exists, else append
    data.days = data.days.filter(d => d.date !== today);
    data.days.push({ date: today, tone });
    // Keep last 14 days
    data.days = data.days.slice(-14);
    localStorage.setItem(OPENING_STREAK_KEY, JSON.stringify(data));
  } catch { }
}

export function getOpeningToneStreak(): { heavyDaysLast14: number; positiveDaysLast14: number; totalDaysLast14: number } {
  try {
    const raw = localStorage.getItem(OPENING_STREAK_KEY);
    if (!raw) return { heavyDaysLast14: 0, positiveDaysLast14: 0, totalDaysLast14: 0 };
    const data: OpeningStreak = JSON.parse(raw);
    return {
      heavyDaysLast14: data.days.filter(d => d.tone === "heavy").length,
      positiveDaysLast14: data.days.filter(d => d.tone === "positive").length,
      totalDaysLast14: data.days.length,
    };
  } catch {
    return { heavyDaysLast14: 0, positiveDaysLast14: 0, totalDaysLast14: 0 };
  }
}
