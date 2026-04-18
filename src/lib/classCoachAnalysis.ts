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
      headline: "Hai aperto la classe e l'hai impostata: il primo passo è già fatto.",
      paragraph: "Per ora non c'è nessuno dentro, quindi non posso ancora leggere segnali su metodo o clima. Appena gli studenti entreranno con il codice, ti aiuterò a capire come stanno andando — sia sul piano didattico che su quello emotivo.",
      evidences: [{
        id: "create-welcome",
        text: "Preparare un primo materiale di benvenuto rende l'arrivo dei ragazzi più caldo.",
        actionLabel: "Crea materiale",
        actionType: "create",
      }],
    };
  }

  // ─── Cold start: no activity yet ───────────────────────────────
  if (assignmentResults.length === 0 && manualGrades.length === 0) {
    return {
      headline: "La classe è entrata: ora serve un primo punto di partenza per leggerla.",
      paragraph: "Gli studenti ci sono ma non hanno ancora svolto attività, quindi non posso ancora dirti come stanno rispondendo. Un esercizio breve, anche minimo, mi basta per cominciare a leggere il livello reale e segnalarti subito eventuali difficoltà — prima che diventino evidenti.",
      evidences: [{
        id: "create-first",
        text: "Un primo compito leggero ti darà una lettura concreta del livello reale della classe.",
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
    headline = "Da due settimane la classe non si fa sentire: vale la pena riallacciare il filo.";
    paragraph = climateLow
      ? "I ragazzi non stanno consegnando e nei check-in il tono si è abbassato — di solito non è pigrizia, è disinvestimento. Un'attività leggera, più per riattivare il legame che per misurare il livello, può rompere lo stallo senza pressione."
      : "I ragazzi non stanno consegnando da tempo: di solito vuol dire che l'attività attuale è troppo distante da dove sono ora, o che non hanno ben capito cosa fare. Una proposta diversa e più leggera può riattivarli senza forzature.";
  } else if (methodIssue && climateLow) {
    headline = "La classe sta lavorando, ma sia il ritmo sia il clima si stanno abbassando insieme.";
    paragraph = topTopic
      ? `I ragazzi stanno provandoci, però su "${topTopic}" si stanno bloccando in più, e nei check-in degli ultimi giorni il tono è più stanco del solito. Spesso le due cose si alimentano: meglio chiarire l'argomento e alleggerire il carico per qualche giorno, prima di insistere sul programma.`
      : "I ragazzi stanno mettendo impegno, ma nelle ultime attività si vede fatica diffusa e nei check-in il tono è più basso. Quando metodo e clima calano insieme si rinforzano a vicenda: vale la pena intervenire su entrambi prima di andare avanti.";
  } else if (methodIssue) {
    if (topTopic && topTopicCount >= 3) {
      headline = `La classe sta lavorando, ma "${topTopic}" sta bloccando più studenti insieme.`;
      paragraph = "Quando lo stesso argomento ferma diverse persone, di solito non è impegno: la spiegazione iniziale ha lasciato un buco. Conviene chiuderlo ora — se costruiamo male qui, tutto quello che viene dopo diventa più difficile.";
    } else if (completionRatio < 0.6) {
      headline = "La classe c'è, ma sta consegnando meno del previsto.";
      paragraph = "Non è una questione di voglia: quando le consegne calano insieme ai risultati, di solito vuol dire che il modo in cui stai chiedendo le cose è troppo distante da dove sono ora. Un'attività di formato diverso — più breve, più guidata, o con un'entrata più concreta — può riallinearli.";
    } else {
      headline = `La classe sta provando, ma ${strugglingStudents.length} su ${students.length} faticano nello stesso punto.`;
      paragraph = "Quando così tanti studenti inciampano insieme, di solito non è un problema di impegno: è il canale che non sta passando. Una spiegazione con un altro angolo — esempio diverso, supporto visivo, attività più concreta — può sbloccare chi resta indietro.";
    }
  } else if (climateLow) {
    headline = "I voti tengono, ma il clima della classe si è abbassato negli ultimi giorni.";
    paragraph = "I ragazzi stanno lavorando bene sul piano didattico, però nei check-in vedo un tono più stanco e qualche segnale di pressione. È il momento di alleggerire un po': insistere ora rischia di trasformare la fatica in disinvestimento. Una pausa di rinforzo, anche breve, vale più di una verifica nuova.";
  } else if (inactiveCount >= Math.ceil(students.length / 3)) {
    headline = `Buona parte della classe è attiva, ma ${inactiveCount} studenti non si fanno sentire da una settimana.`;
    paragraph = "Spesso non è disinteresse: o non si sentono coinvolti dal compito attuale, o stanno perdendo fiducia in silenzio. Una sollecitazione mirata, anche solo un messaggio personale, può fare la differenza prima che l'inattività diventi abitudine.";
  } else if (!hasEnoughEmotionalData) {
    headline = "La classe sta tenendo bene sul lato didattico.";
    paragraph = "Sul piano dell'apprendimento non vedo segnali critici, è un buon momento. Ho però ancora pochi check-in emotivi recenti per leggere davvero il clima: un check-in collettivo aiuta a capire come stanno, non solo come stanno andando.";
  } else {
    headline = "La classe sta tenendo bene: è il momento giusto per consolidare.";
    paragraph = "I ragazzi stanno lavorando con un buon ritmo e nessuno è particolarmente indietro. Proprio per questo è il momento migliore per rinforzare: quando tutto fila, sono più disposti ad accettare una sfida o a fissare quello che hanno appena imparato. Aspettare il prossimo calo significa rincorrere.";
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
      text: `${worst.name} sta provando a tenere il passo, ma sta restando indietro rispetto al resto: vale la pena un occhio dedicato.`,
      actionLabel: "Vedi andamento",
      actionType: "trend",
      targetStudentId: worst.sid,
      targetStudentName: worst.name,
    });
  }

  return { headline, paragraph, evidences: evidences.slice(0, 3) };
}
