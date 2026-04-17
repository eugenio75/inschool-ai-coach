/**
 * Class Coach Analysis — proactive, class-first reading.
 *
 * Headline + paragraph SEMPRE parlano della classe come insieme:
 *   - lettura del metodo / andamento collettivo
 *   - lettura del clima emotivo (se ci sono dati sufficienti: ≥40% check-in negli ultimi 7gg)
 *
 * Le evidence rows sono un mix di azioni su:
 *   - metodo / argomento ricorrente
 *   - clima emotivo (alleggerire, check-in di classe)
 *   - studente specifico SOLO quando emerge davvero un caso
 *
 * Tono: osservativo, mai diagnostico. Mai "la classe è ansiosa" — sempre
 * "negli ultimi giorni il clima si è abbassato, vale la pena alleggerire".
 */

export interface AnalysisInput {
  students: any[];
  assignmentResults: any[];
  manualGrades: any[];
  classSubject: string;
  lastActivityMap: Record<string, string>;
  emotionalCheckins?: any[];
  emotionalAlerts?: any[];
  focusSessions?: any[];
}

export interface CoachInsight {
  headline: string;
  paragraph: string;
  evidences: Array<{
    id: string;
    text: string;
    actionLabel: string;
    actionType: "recovery" | "alternative" | "trend" | "create" | "contact" | "checkin";
    targetTopic?: string;
    targetSubject?: string;
    targetStudentId?: string;
    targetStudentName?: string;
  }>;
}

const DAY = 86400000;
const SEVEN_DAYS = 7 * DAY;
const FOURTEEN_DAYS = 14 * DAY;

const NEGATIVE_TONES = new Set(["sad", "angry", "anxious", "frustrated", "tired", "stressed", "overwhelmed", "negative"]);
const NEGATIVE_ENERGY = new Set(["low", "very_low"]);
const NEGATIVE_EMOTIONS = new Set(["frustrated", "tired", "anxious", "sad", "overwhelmed", "stressed"]);

const BLOCKED_TOPIC_KEYS = new Set([
  "common_errors", "errors", "error", "summary", "score", "metric",
  "metrics", "total", "count", "details", "data", "meta", "info",
]);

function isValidTopic(t: string): boolean {
  const v = (t || "").trim();
  if (!v) return false;
  if (BLOCKED_TOPIC_KEYS.has(v.toLowerCase())) return false;
  if (/^[a-z_]+$/.test(v)) return false;
  return true;
}

export function analyzeClass(input: AnalysisInput): CoachInsight {
  const {
    students,
    assignmentResults,
    manualGrades,
    classSubject,
    lastActivityMap,
    emotionalCheckins = [],
    emotionalAlerts = [],
    focusSessions = [],
  } = input;
  const now = Date.now();

  // ─── Empty class ───────────────────────────────────────────────
  if (students.length === 0) {
    return {
      headline: "La classe è vuota: condividi il codice per iniziare.",
      paragraph: "Appena gli studenti entreranno, ti aiuterò a leggere come stanno andando: metodo di studio, ritmo, clima della classe. Non aspettare che siano in difficoltà per accorgertene.",
      evidences: [{
        id: "create-welcome",
        text: "Puoi preparare un primo materiale di benvenuto per quando entreranno.",
        actionLabel: "Crea materiale",
        actionType: "create",
      }],
    };
  }

  // ─── Cold start: no activity yet ───────────────────────────────
  if (assignmentResults.length === 0 && manualGrades.length === 0) {
    return {
      headline: "La classe non ha ancora svolto attività: serve un primo punto di partenza.",
      paragraph: "Senza attività non posso ancora leggere segnali su metodo o clima. Ti consiglio di iniziare con un esercizio breve: anche pochi dati mi permettono di capire come la classe risponde, prima che eventuali difficoltà diventino evidenti.",
      evidences: [{
        id: "create-first",
        text: "Un primo compito leggero ti darà subito una lettura del livello reale.",
        actionLabel: "Crea compito",
        actionType: "create",
      }],
    };
  }

  // ─── Compute didactic signals ──────────────────────────────────
  const studentScores: Record<string, number[]> = {};
  const errorTopics: Record<string, number> = {};
  let totalAssigned = 0;
  let totalCompleted = 0;

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const sid = r.student_id || r.id;
      if (!studentScores[sid]) studentScores[sid] = [];
      if (r.score != null) studentScores[sid].push(r.score);
      totalAssigned++;
      if (r.status === "completed") totalCompleted++;
      if (r.errors_summary && typeof r.errors_summary === "object") {
        Object.entries(r.errors_summary).forEach(([topic, count]: [string, any]) => {
          if (!isValidTopic(topic)) return;
          errorTopics[topic.trim()] = (errorTopics[topic.trim()] || 0) + (typeof count === "number" ? count : 1);
        });
      }
    });
  });

  const nameOf: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    nameOf[sid] = s.profile?.name || s.student_name || "Studente";
  });

  // Struggling students (mean < 60 across at least 1 score)
  const strugglingStudents = students
    .map((s: any) => {
      const sid = s.student_id || s.id;
      const sc = studentScores[sid] || [];
      if (sc.length === 0) return null;
      const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
      return mean < 60 ? { sid, name: nameOf[sid], mean } : null;
    })
    .filter(Boolean) as Array<{ sid: string; name: string; mean: number }>;

  // Top recurring error topic
  const topErrors = Object.entries(errorTopics).sort(([, a], [, b]) => b - a);
  const topTopic = topErrors[0]?.[0];
  const topTopicCount = topErrors[0]?.[1] || 0;

  const completionRatio = totalAssigned > 0 ? totalCompleted / totalAssigned : 1;

  // Inactive students (no activity in 7+ days)
  const inactiveCount = students.filter((s: any) => {
    const sid = s.student_id || s.id;
    const last = lastActivityMap[sid];
    return !last || now - new Date(last).getTime() > SEVEN_DAYS;
  }).length;

  const allInactive14d = students.every((s: any) => {
    const sid = s.student_id || s.id;
    const last = lastActivityMap[sid];
    return !last || now - new Date(last).getTime() > FOURTEEN_DAYS;
  });

  // ─── Compute emotional climate (last 7 days) ───────────────────
  const sevenDaysAgo = now - SEVEN_DAYS;
  const recentCheckins = emotionalCheckins.filter((c) => {
    const t = new Date(c.created_at || c.checkin_date).getTime();
    return t >= sevenDaysAgo;
  });

  // Unique students who did a check-in in last 7d
  const studentsWithCheckin = new Set(recentCheckins.map((c) => c.child_profile_id));
  const checkinCoverage = students.length > 0 ? studentsWithCheckin.size / students.length : 0;

  const negativeCheckins = recentCheckins.filter(
    (c) => NEGATIVE_TONES.has((c.emotional_tone || "").toLowerCase()) ||
           NEGATIVE_ENERGY.has((c.energy_level || "").toLowerCase()),
  );
  const negativeRatio = recentCheckins.length > 0 ? negativeCheckins.length / recentCheckins.length : 0;

  const recentNegativeFocus = focusSessions.filter((f) => {
    const t = new Date(f.completed_at || 0).getTime();
    return t >= sevenDaysAgo && NEGATIVE_EMOTIONS.has((f.emotion || "").toLowerCase());
  }).length;

  const openAlerts = emotionalAlerts.filter((a) => !a.read).length;

  const hasEnoughEmotionalData = checkinCoverage >= 0.4;
  const climateLow =
    hasEnoughEmotionalData &&
    (negativeRatio >= 0.4 || openAlerts >= 2 || recentNegativeFocus >= 3);

  // ─── Build class-first headline + paragraph ────────────────────
  let headline = "";
  let paragraph = "";
  const evidences: CoachInsight["evidences"] = [];

  // Decide primary frame: method vs climate vs both vs steady
  const methodIssue =
    strugglingStudents.length >= Math.ceil(students.length / 3) ||
    completionRatio < 0.6 ||
    (topTopic && topTopicCount >= 3) ||
    allInactive14d;

  if (allInactive14d) {
    headline = "Da due settimane la classe è ferma: nessuno sta lavorando.";
    paragraph = climateLow
      ? "Quando una classe smette di consegnare e nei check-in il tono si abbassa, di solito non è pigrizia: è disinvestimento. Vale la pena partire da qualcosa di leggero, più per riattivare il legame che per misurare il livello."
      : "Quando una classe smette di consegnare, di solito non è pigrizia: o non hanno capito cosa fare, o l'attività è troppo distante da dove sono ora. Vale la pena proporre qualcosa di diverso e leggero per riattivarli.";
  } else if (methodIssue && climateLow) {
    headline = "La classe sta rallentando, e anche il clima si sta abbassando.";
    paragraph = topTopic
      ? `Stanno emergendo difficoltà su "${topTopic}" e nei check-in degli ultimi giorni si vede un tono più stanco del solito. È un segnale che il problema non è solo didattico: prima di insistere sul programma, vale la pena chiarire l'argomento e alleggerire il carico per qualche giorno.`
      : "Le ultime attività mostrano fatica diffusa e nei check-in degli ultimi giorni il tono è più basso del solito. Spesso le due cose si alimentano: quando il metodo non funziona, il clima si abbassa, e con un clima basso si fatica ancora di più. Meglio intervenire su entrambi.";
  } else if (methodIssue) {
    if (topTopic && topTopicCount >= 3) {
      headline = `"${topTopic}" sta dando problemi a più studenti.`;
      paragraph = "Quando lo stesso argomento blocca diverse persone, di solito vuol dire che la spiegazione iniziale ha lasciato un buco. Meglio chiarirlo ora: se lo costruiamo male qui, tutto quello che viene dopo diventa più difficile.";
    } else if (completionRatio < 0.6) {
      headline = "La classe consegna meno del dovuto: è un segnale di metodo.";
      paragraph = "Quando si consegna poco e si va comunque bene, di solito vuol dire che le attività sono troppo facili o non coinvolgono. Quando invece le consegne calano insieme ai voti, è il momento di rivedere come si sta proponendo l'argomento, non quanto stanno studiando.";
    } else {
      headline = `Più studenti stanno facendo fatica insieme: ${strugglingStudents.length} su ${students.length}.`;
      paragraph = "Quando così tanti studenti faticano insieme, di solito non è un problema di impegno: è il metodo o l'argomento che non sta passando bene. Proviamo a cambiare angolo prima di insistere.";
    }
  } else if (climateLow) {
    headline = "Il clima della classe si è abbassato negli ultimi giorni.";
    paragraph = "I voti per ora tengono, ma nei check-in vedo un tono più stanco e qualche segnale di pressione. È il momento di alleggerire un po': insistere ora rischia di trasformare la fatica in disinvestimento. Una pausa di rinforzo, anche breve, vale più di una verifica nuova.";
  } else if (inactiveCount >= Math.ceil(students.length / 3)) {
    headline = `${inactiveCount} studenti non si fanno sentire da una settimana.`;
    paragraph = "Un terzo della classe ferma è un segnale che non va sottovalutato. Spesso significa che non sono coinvolti dal compito attuale o stanno perdendo fiducia. Una sollecitazione mirata può fare la differenza, prima che l'inattività diventi abitudine.";
  } else if (!hasEnoughEmotionalData) {
    headline = "La classe sta tenendo bene sul piano didattico.";
    paragraph = "Sul lato apprendimento non vedo segnali critici, ma ho ancora pochi check-in emotivi recenti per leggere il clima della classe. Proporre un check-in collettivo aiuta a capire come stanno davvero, non solo come stanno andando.";
  } else {
    headline = "La classe sta tenendo bene: è il momento giusto per consolidare.";
    paragraph = "Non vedo segnali critici né sul metodo né sul clima, ma proprio per questo è il momento migliore per rinforzare: quando tutto fila, gli studenti sono più disposti ad accettare una sfida o a fissare quello che hanno appena imparato. Aspettare il prossimo calo significa rincorrere.";
  }

  // ─── Build evidence rows (max 3) ───────────────────────────────

  // Evidence 1: method / topic
  if (topTopic && topTopicCount >= 2) {
    evidences.push({
      id: "ev-method-topic",
      text: `Un esercizio di recupero su "${topTopic}" può chiudere il buco prima che si ampli.`,
      actionLabel: "Genera recupero",
      actionType: "recovery",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
  } else if (allInactive14d || (inactiveCount >= Math.ceil(students.length / 3))) {
    evidences.push({
      id: "ev-restart",
      text: "Un compito breve e accessibile può rompere lo stallo senza pressione.",
      actionLabel: "Crea compito",
      actionType: "create",
    });
  } else if (completionRatio < 0.6 && totalAssigned >= 3) {
    evidences.push({
      id: "ev-challenge",
      text: "Una sfida un po' più impegnativa misura meglio dove sono davvero.",
      actionLabel: "Crea compito",
      actionType: "create",
    });
  } else {
    evidences.push({
      id: "ev-consolidate",
      text: topTopic
        ? `Un breve ripasso su "${topTopic}" può fissare quello che è appena passato.`
        : "Un breve ripasso sugli ultimi argomenti può fissare le competenze.",
      actionLabel: "Crea ripasso",
      actionType: "create",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
  }

  // Evidence 2: emotional climate
  if (climateLow) {
    evidences.push({
      id: "ev-climate",
      text: "Una lezione più leggera o un'attività di gruppo aiuta ad alleggerire prima di introdurre cose nuove.",
      actionLabel: "Spiegazione alternativa",
      actionType: "alternative",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
  } else if (!hasEnoughEmotionalData && students.length >= 3) {
    evidences.push({
      id: "ev-checkin",
      text: "Ho pochi check-in emotivi recenti: vale la pena vedere come sta la classe.",
      actionLabel: "Vedi andamento",
      actionType: "trend",
    });
  }

  // Evidence 3: specific student — only when a real case emerges
  if (strugglingStudents.length > 0 && evidences.length < 3) {
    const worst = strugglingStudents.sort((a, b) => a.mean - b.mean)[0];
    evidences.push({
      id: `ev-student-${worst.sid}`,
      text: `${worst.name} sta rimanendo indietro rispetto al resto della classe — vale la pena un occhio dedicato.`,
      actionLabel: "Vedi andamento",
      actionType: "trend",
      targetStudentId: worst.sid,
      targetStudentName: worst.name,
    });
  }

  return { headline, paragraph, evidences: evidences.slice(0, 3) };
}
