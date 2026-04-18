/**
 * Class Full-Picture Analysis — narrative readout for the "Quadro completo" page.
 *
 * Returns four educator-friendly blocks:
 *   - learning (cosa è consolidato / cosa non è ancora chiaro)
 *   - method   (il metodo sta funzionando? per chi no?)
 *   - climate  (clima ed emozioni — linguaggio educativo, mai clinico)
 *   - followStudents (chi richiede attenzione individuale oggi)
 *
 * Tutto in italiano corrente, senza percentuali, punteggi, nomi di variabile.
 */

export interface FullPictureInput {
  students: any[];
  assignmentResults: any[];
  manualGrades: any[];
  classSubject: string;
  lastActivityMap: Record<string, string>;
  emotionalCheckins?: any[];
  emotionalAlerts?: any[];
  focusSessions?: any[];
}

export interface FullPictureFollowStudent {
  studentId: string;
  studentName: string;
  reason: string;
  /** "recovery" | "profile" — both rendered as buttons */
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

export interface FullPictureInsight {
  learning: {
    paragraph: string;
    consolidated: string[];
    unclear: string[];
  };
  method: {
    paragraph: string;
  };
  climate: {
    paragraph: string;
    hasSignals: boolean;
  };
  followStudents: FullPictureFollowStudent[];
}

const DAY = 86400000;
const SEVEN_DAYS = 7 * DAY;

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

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return `"${items[0]}"`;
  if (items.length === 2) return `"${items[0]}" e "${items[1]}"`;
  return items.slice(0, -1).map((s) => `"${s}"`).join(", ") + ` e "${items[items.length - 1]}"`;
}

export function analyzeFullPicture(input: FullPictureInput): FullPictureInsight {
  const {
    students,
    assignmentResults,
    manualGrades,
    lastActivityMap,
    emotionalCheckins = [],
    emotionalAlerts = [],
    focusSessions = [],
  } = input;
  const now = Date.now();

  // ─── No students ──────────────────────────────────────────────
  if (students.length === 0) {
    return {
      learning: {
        paragraph: "Hai impostato la classe e questo è già un primo passo. Per ora però è vuota e non ho dati per leggere come sta andando l'apprendimento. Appena gli studenti entreranno con il codice, qui troverai un quadro chiaro di cosa è consolidato e cosa serve riprendere.",
        consolidated: [],
        unclear: [],
      },
      method: {
        paragraph: "La classe c'è sulla carta, ma senza attività degli studenti non ho ancora elementi per dirti se il metodo sta funzionando. Appena svolgeranno i primi compiti potrò darti una lettura concreta.",
      },
      climate: {
        paragraph: "Nessun segnale particolare questa settimana — semplicemente perché non ci sono ancora studenti che possano dar vita al clima della classe.",
        hasSignals: false,
      },
      followStudents: [],
    };
  }

  // ─── Compute per-student scores and topic errors ──────────────
  const studentScores: Record<string, number[]> = {};
  const errorTopics: Record<string, number> = {};
  const goodTopics: Record<string, number> = {};
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
      // If score is high and no errors, count topic of the assignment as consolidated
      if (r.score != null && r.score >= 7 && (!r.errors_summary || Object.keys(r.errors_summary).length === 0)) {
        const topic = (a.title || "").trim();
        if (isValidTopic(topic)) {
          goodTopics[topic] = (goodTopics[topic] || 0) + 1;
        }
      }
    });
  });

  const nameOf: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    nameOf[sid] = s.profile?.name || s.student_name || "Studente";
  });

  // Top recurring error topics (max 2)
  const unclearList = Object.entries(errorTopics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([t]) => t);

  const consolidatedList = Object.entries(goodTopics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([t]) => t);

  // Struggling students (mean < 60)
  const strugglingStudents = students
    .map((s: any) => {
      const sid = s.student_id || s.id;
      const sc = studentScores[sid] || [];
      if (sc.length === 0) return null;
      const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
      return mean < 60 ? { sid, name: nameOf[sid], mean } : null;
    })
    .filter(Boolean) as Array<{ sid: string; name: string; mean: number }>;

  const completionRatio = totalAssigned > 0 ? totalCompleted / totalAssigned : 1;

  // ─── 1. Apprendimento ─────────────────────────────────────────
  let learningParagraph = "";
  if (totalAssigned === 0 && manualGrades.length === 0) {
    learningParagraph = "La classe è entrata e c'è, ma non ha ancora attività completate da cui leggere il livello reale. Appena consegnano le prime cose, potrò dirti con precisione cosa hanno consolidato e dove serve insistere.";
  } else if (consolidatedList.length === 0 && unclearList.length === 0) {
    learningParagraph = "La classe sta lavorando, ma per ora il quadro è ancora omogeneo: non emergono né punti chiaramente consolidati né argomenti particolarmente in difficoltà. Servono un paio di attività in più per leggere differenze nette.";
  } else if (consolidatedList.length > 0 && unclearList.length > 0) {
    learningParagraph = `La classe ha a fuoco ${joinList(consolidatedList)} — lì si vedono risultati solidi e pochi errori. Sta invece incontrando un blocco ricorrente su ${joinList(unclearList)}: gli stessi inciampi tornano in più studenti, segno che la spiegazione iniziale ha lasciato dei buchi che vale la pena chiudere prima di andare avanti.`;
  } else if (unclearList.length > 0) {
    learningParagraph = `La classe sta provandoci, però c'è un punto da chiudere: ${joinList(unclearList)}. Lì si concentrano gli errori ricorrenti — non è un caso isolato, sta toccando più studenti, quindi conviene riprenderlo come classe prima di costruirci sopra altro.`;
  } else {
    learningParagraph = `Sui temi di ${joinList(consolidatedList)} la classe è in piedi: i risultati tengono e gli errori sono pochi. È un buon momento per consolidare con un ripasso leggero, oppure per spostarsi sul prossimo argomento.`;
  }

  // ─── 2. Metodo ────────────────────────────────────────────────
  let methodParagraph = "";
  const methodNotWorking =
    strugglingStudents.length >= Math.ceil(students.length / 3) ||
    completionRatio < 0.6;

  if (totalAssigned === 0) {
    methodParagraph = "I ragazzi ci sono ma non hanno ancora svolto attività: aspetto le prime consegne per leggere come la classe risponde al metodo che stai usando.";
  } else if (methodNotWorking && strugglingStudents.length >= Math.ceil(students.length / 3)) {
    methodParagraph = `Il modo in cui stai proponendo l'argomento sta funzionando per buona parte della classe — la maggior parte dei ragazzi ti sta seguendo. Però ${strugglingStudents.length} studenti su ${students.length} faticano nello stesso punto. Quando così tante persone inciampano insieme di solito non è impegno: è il canale che non sta passando. Una spiegazione con un altro angolo — esempio diverso, supporto visivo, attività più concreta — può sbloccare chi resta indietro.`;
  } else if (methodNotWorking && completionRatio < 0.6) {
    methodParagraph = "La classe sta provando a stare al passo, ma sta consegnando meno del previsto. Quando le consegne calano insieme ai risultati, di solito vuol dire che il modo in cui stai chiedendo le cose è troppo distante da dove sono ora. Vale la pena provare un'attività di formato diverso — più breve, più guidata, o con un'entrata più concreta — per riallinearli.";
  } else if (strugglingStudents.length > 0) {
    methodParagraph = `Il metodo che stai usando sta funzionando per la maggior parte della classe — la rotta generale tiene. Restano però ${strugglingStudents.length} ${strugglingStudents.length === 1 ? "studente che fatica" : "studenti che faticano"} a tenere il passo: per loro non serve cambiare l'impianto generale, ma offrire un canale diverso in parallelo — un materiale di supporto, una spiegazione più concreta o un piccolo affiancamento.`;
  } else {
    methodParagraph = "Il metodo che stai usando sta funzionando: i risultati tengono e nessuno è particolarmente indietro. È il momento giusto per consolidare con qualcosa di un po' più impegnativo, prima che l'attenzione cali per mancanza di stimolo.";
  }

  // ─── 3. Clima ed emozioni ─────────────────────────────────────
  const sevenDaysAgo = now - SEVEN_DAYS;
  const recentCheckins = emotionalCheckins.filter((c) => {
    const t = new Date(c.created_at || c.checkin_date).getTime();
    return t >= sevenDaysAgo;
  });
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

  let climateParagraph = "";
  let hasSignals = false;

  if (!hasEnoughEmotionalData) {
    climateParagraph = "I ragazzi stanno frequentando la classe, ma ho ancora pochi check-in recenti per leggere davvero il clima. Un check-in collettivo, anche breve, aiuta a sentire come stanno — non solo come stanno andando.";
  } else if (climateLow) {
    hasSignals = true;
    const parts: string[] = [];
    if (negativeRatio >= 0.4) parts.push("nei check-in di questa settimana il tono è più stanco del solito");
    if (recentNegativeFocus >= 3) parts.push("durante le sessioni di studio si è alzata la frustrazione");
    if (openAlerts >= 2) parts.push("ci sono segnali aperti che meritano un'occhiata");
    climateParagraph = `La classe sta continuando a lavorare, ma qualcosa nel clima sta cambiando: ${parts.join(", ")}. Non è ancora un allarme, è il momento di alleggerire il carico e ascoltare. Quando la fatica resta sommersa, di solito si trasforma in disinvestimento qualche settimana dopo.`;
  } else {
    climateParagraph = "La classe sta tenendo bene anche sul piano emotivo: i check-in restano nella norma e non emergono pattern di fatica diffusa. Nessun segnale particolare questa settimana.";
  }

  // ─── 4. Studenti da seguire ───────────────────────────────────
  const followStudents: FullPictureFollowStudent[] = [];

  // (a) Struggling academically
  strugglingStudents
    .sort((a, b) => a.mean - b.mean)
    .slice(0, 3)
    .forEach((s) => {
      followStudents.push({
        studentId: s.sid,
        studentName: s.name,
        reason: "Sta provando a stare al passo, ma le ultime attività mostrano un ritmo più lento del resto della classe — un piccolo affiancamento può fare la differenza.",
        primaryActionLabel: "Recupero",
        secondaryActionLabel: "Profilo",
      });
    });

  // (b) Inactive students (no activity in 7+ days)
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    if (followStudents.some((f) => f.studentId === sid)) return;
    const last = lastActivityMap[sid];
    if (!last || now - new Date(last).getTime() > SEVEN_DAYS) {
      if (followStudents.length < 5) {
        followStudents.push({
          studentId: sid,
          studentName: nameOf[sid],
          reason: "È iscritto alla classe ma non si fa sentire da più di una settimana — vale la pena un contatto diretto per capire cosa sta succedendo.",
          primaryActionLabel: "Recupero",
          secondaryActionLabel: "Profilo",
        });
      }
    }
  });

  // (c) Students with negative emotional signals
  const negativeByStudent: Record<string, number> = {};
  negativeCheckins.forEach((c) => {
    negativeByStudent[c.child_profile_id] = (negativeByStudent[c.child_profile_id] || 0) + 1;
  });
  Object.entries(negativeByStudent)
    .sort(([, a], [, b]) => b - a)
    .forEach(([sid, count]) => {
      if (followStudents.some((f) => f.studentId === sid)) return;
      if (count < 2) return;
      if (followStudents.length >= 5) return;
      const name = nameOf[sid] || "Studente";
      followStudents.push({
        studentId: sid,
        studentName: name,
        reason: "Sta continuando a partecipare, ma negli ultimi check-in ha lasciato segnali di fatica: vale un momento di ascolto.",
        primaryActionLabel: "Profilo",
        secondaryActionLabel: "Recupero",
      });
    });

  return {
    learning: {
      paragraph: learningParagraph,
      consolidated: consolidatedList,
      unclear: unclearList,
    },
    method: {
      paragraph: methodParagraph,
    },
    climate: {
      paragraph: climateParagraph,
      hasSignals,
    },
    followStudents: followStudents.slice(0, 5),
  };
}
