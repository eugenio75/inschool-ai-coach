/**
 * Class Coach Analysis — proactive analysis of a class.
 *
 * The Coach MUST always perform a check on the class to surface signals of:
 * - method issues (low completion, fast resolutions hiding shallow understanding)
 * - slowdowns (gradual decrease in activity or scores)
 * - knowledge gaps (recurring error topics across students)
 *
 * This prevents the teacher from blaming the class when the real issue is
 * pedagogical, structural, or undetected. Even when "everything looks fine",
 * the Coach should still surface a weak signal to consider.
 */

export interface AnalysisInput {
  students: any[];
  assignmentResults: any[];
  manualGrades: any[];
  classSubject: string;
  lastActivityMap: Record<string, string>;
}

export interface CoachInsight {
  headline: string;
  paragraph: string;
  evidences: Array<{
    id: string;
    text: string;
    actionLabel: string;
    actionType: "recovery" | "alternative" | "trend" | "create" | "contact";
    targetTopic?: string;
    targetSubject?: string;
    targetStudentId?: string;
    targetStudentName?: string;
  }>;
}

export function analyzeClass(input: AnalysisInput): CoachInsight {
  const { students, assignmentResults, manualGrades, classSubject, lastActivityMap } = input;
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  const FOURTEEN_DAYS = 14 * 86400000;

  // ─── Empty class ───────────────────────────────────────────────
  if (students.length === 0) {
    return {
      headline: "La classe è vuota: condividi il codice per iniziare.",
      paragraph: "Appena gli studenti entreranno, ti aiuterò a leggere come stanno andando: metodo di studio, ritmo, lacune. Non aspettare che siano in difficoltà per accorgertene.",
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
      paragraph: "Senza attività non posso ancora leggere segnali. Ti consiglio di iniziare con un esercizio breve: anche pochi dati mi permettono di capire metodo, lacune e ritmo, prima che diventino problemi reali.",
      evidences: [{
        id: "create-first",
        text: "Un primo compito leggero ti darà subito una lettura del livello reale.",
        actionLabel: "Crea compito",
        actionType: "create",
      }],
    };
  }

  // ─── Compute student-level signals ─────────────────────────────
  const studentScores: Record<string, number[]> = {};
  const errorTopics: Record<string, number> = {};
  const lateByStudent: Record<string, number> = {};
  let totalAssigned = 0;
  let totalCompleted = 0;

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const sid = r.student_id || r.id;
      if (!studentScores[sid]) studentScores[sid] = [];
      if (r.score != null) studentScores[sid].push(r.score);
      totalAssigned++;
      if (r.status === "completed") totalCompleted++;
      else lateByStudent[sid] = (lateByStudent[sid] || 0) + 1;
      if (r.errors_summary && typeof r.errors_summary === "object") {
        Object.entries(r.errors_summary).forEach(([topic, count]: [string, any]) => {
          errorTopics[topic] = (errorTopics[topic] || 0) + (typeof count === "number" ? count : 1);
        });
      }
    });
  });

  // Build name lookup
  const nameOf: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    nameOf[sid] = s.profile?.name || s.student_name || "Studente";
  });

  // Struggling students (mean < 60 across at least 1 score)
  const strugglingStudents = students.filter((s: any) => {
    const sid = s.student_id || s.id;
    const sc = studentScores[sid] || [];
    if (sc.length === 0) return false;
    const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
    return mean < 60;
  });

  // Inactive students (no activity in 7+ days)
  const inactiveStudents = students.filter((s: any) => {
    const sid = s.student_id || s.id;
    const last = lastActivityMap[sid];
    if (!last) return true;
    return now - new Date(last).getTime() > SEVEN_DAYS;
  });

  // Top recurring error topic
  const topErrors = Object.entries(errorTopics).sort(([, a], [, b]) => b - a);
  const topTopic = topErrors[0]?.[0];
  const topTopicCount = topErrors[0]?.[1] || 0;

  // Completion ratio
  const completionRatio = totalAssigned > 0 ? totalCompleted / totalAssigned : 1;

  // Long-term inactivity (no activity >14d for whole class)
  const allInactive14d = students.every((s: any) => {
    const sid = s.student_id || s.id;
    const last = lastActivityMap[sid];
    return !last || now - new Date(last).getTime() > FOURTEEN_DAYS;
  });

  const evidences: CoachInsight["evidences"] = [];

  // ─── PRIORITY 1: Critical struggling students ──────────────────
  if (strugglingStudents.length >= 3) {
    const headline = `Più di metà classe (${strugglingStudents.length} su ${students.length}) sta facendo fatica.`;
    const paragraph = "Quando così tanti studenti faticano insieme, di solito non è un problema di impegno: è il metodo o l'argomento che non sta passando bene. Proviamo a cambiare angolo prima di insistere.";
    evidences.push({
      id: "ev-recovery-class",
      text: topTopic
        ? `Errori ricorrenti su "${topTopic}" in tutta la classe.`
        : "Difficoltà diffuse sulle ultime attività.",
      actionLabel: "Genera recupero",
      actionType: "recovery",
      targetTopic: topTopic || "argomenti recenti",
      targetSubject: classSubject,
    });
    evidences.push({
      id: "ev-alt-explain",
      text: "Provare una spiegazione con esempi diversi può sbloccare chi non ha capito il primo passaggio.",
      actionLabel: "Spiegazione alternativa",
      actionType: "alternative",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
    return { headline, paragraph, evidences };
  }

  if (strugglingStudents.length > 0) {
    const first = strugglingStudents[0];
    const sid = first.student_id || first.id;
    const name = nameOf[sid];
    const headline = `${name} sta rimanendo indietro rispetto al resto della classe.`;
    const paragraph = "Non è ancora un campanello d'allarme generale, ma è il momento giusto per intervenire: aspettare significa lasciare che la lacuna si trascini sui prossimi argomenti.";
    evidences.push({
      id: `ev-rec-${sid}`,
      text: topTopic
        ? `Errori frequenti su "${topTopic}" — vale la pena un esercizio mirato.`
        : "Le ultime prove sono andate sotto la sufficienza.",
      actionLabel: "Genera recupero",
      actionType: "recovery",
      targetTopic: topTopic || "argomenti recenti",
      targetSubject: classSubject,
      targetStudentId: sid,
      targetStudentName: name,
    });
    if (strugglingStudents.length === 1) {
      evidences.push({
        id: `ev-contact-${sid}`,
        text: "Una nota ai genitori, in tono leggero, può aiutare a capire se c'è un problema fuori dalla scuola.",
        actionLabel: "Scrivi ai genitori",
        actionType: "contact",
        targetStudentId: sid,
        targetStudentName: name,
      });
    } else {
      const second = strugglingStudents[1];
      const sid2 = second.student_id || second.id;
      evidences.push({
        id: `ev-second-${sid2}`,
        text: `Anche ${nameOf[sid2]} sta mostrando segnali simili.`,
        actionLabel: "Vedi andamento",
        actionType: "trend",
        targetStudentId: sid2,
        targetStudentName: nameOf[sid2],
      });
    }
    return { headline, paragraph, evidences };
  }

  // ─── PRIORITY 2: Inactivity ────────────────────────────────────
  if (allInactive14d) {
    return {
      headline: "Da due settimane la classe è ferma: nessuno sta lavorando.",
      paragraph: "Quando una classe smette di consegnare, di solito non è pigrizia: o non hanno capito cosa fare, o l'attività è troppo distante da dove sono ora. Vale la pena proporre qualcosa di diverso e leggero per riattivarli.",
      evidences: [{
        id: "ev-restart",
        text: "Un compito breve e accessibile può rompere lo stallo senza pressione.",
        actionLabel: "Crea compito",
        actionType: "create",
      }],
    };
  }

  if (inactiveStudents.length >= Math.ceil(students.length / 3)) {
    const headline = `${inactiveStudents.length} studenti non si fanno sentire da una settimana.`;
    const paragraph = "Un terzo della classe ferma è un segnale che non va sottovalutato. Spesso significa che non sono coinvolti dal compito attuale o stanno perdendo fiducia. Una sollecitazione mirata può fare la differenza.";
    evidences.push({
      id: "ev-stale",
      text: "Vale la pena ricordare la consegna in corso a chi non l'ha aperta.",
      actionLabel: "Vedi andamento",
      actionType: "trend",
    });
    return { headline, paragraph, evidences };
  }

  // ─── PRIORITY 3: Knowledge gap (topic-level) ───────────────────
  if (topTopic && topTopicCount >= 3) {
    const headline = `"${topTopic}" sta dando problemi a più studenti.`;
    const paragraph = "Quando lo stesso argomento blocca diverse persone, di solito vuol dire che la spiegazione iniziale ha lasciato un buco. Meglio chiarirlo ora: se lo costruiamo male qui, tutto quello che viene dopo diventa più difficile.";
    evidences.push({
      id: "ev-recovery-topic",
      text: `Un esercizio di recupero su "${topTopic}" può chiudere il buco prima che si ampli.`,
      actionLabel: "Genera recupero",
      actionType: "recovery",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
    evidences.push({
      id: "ev-alt-topic",
      text: "Una spiegazione alternativa, con esempi diversi, è spesso quello che serve davvero.",
      actionLabel: "Spiegazione alternativa",
      actionType: "alternative",
      targetTopic: topTopic,
      targetSubject: classSubject,
    });
    return { headline, paragraph, evidences };
  }

  // ─── PRIORITY 4: Method signal (low completion despite OK scores) ──
  if (completionRatio < 0.6 && totalAssigned >= 3) {
    return {
      headline: "I voti tengono, ma la classe consegna meno del dovuto.",
      paragraph: "È un segnale di metodo, non di capacità: quando si studia poco e si va comunque bene, di solito vuol dire che le attività sono troppo facili o non motivanti. Vale la pena alzare leggermente l'asticella per vedere il livello vero.",
      evidences: [{
        id: "ev-challenge",
        text: "Una sfida un po' più impegnativa misura meglio dove sono davvero.",
        actionLabel: "Crea compito",
        actionType: "create",
      }],
    };
  }

  // ─── DEFAULT: Everything looks fine — but Coach still pushes a weak signal ──
  // The rule: never say "all good" without giving the teacher something to think about.
  return {
    headline: "La classe sta tenendo bene: è il momento giusto per consolidare.",
    paragraph: "Non vedo segnali critici, ma proprio per questo è il momento migliore per rinforzare il metodo: quando tutto fila, gli studenti sono più disposti ad accettare una sfida o a fissare quello che hanno appena imparato. Aspettare fino al prossimo calo significa rincorrere.",
    evidences: [
      {
        id: "ev-consolidate",
        text: topTopic
          ? `Un breve ripasso su "${topTopic}" può fissare quello che è appena passato.`
          : "Un breve ripasso sugli ultimi argomenti può fissare le competenze.",
        actionLabel: "Crea ripasso",
        actionType: "create",
        targetTopic: topTopic,
        targetSubject: classSubject,
      },
      {
        id: "ev-trend",
        text: "Un'occhiata all'andamento generale può confermare se è davvero tutto solido o se qualcuno sta nascondendo difficoltà.",
        actionLabel: "Vedi andamento",
        actionType: "trend",
      },
    ],
  };
}
