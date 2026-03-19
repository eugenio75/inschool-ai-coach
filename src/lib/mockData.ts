// Centralized mock data for Inschool MVP

export interface Task {
  id: string;
  subject: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: number;
  steps: number;
  completed: boolean;
  microSteps?: MicroStep[];
  keyConcepts?: string[];
  recallQuestions?: string[];
}

export interface MicroStep {
  id: string;
  text: string;
  done: boolean;
  hint?: string;
}

export interface GamificationData {
  focusPoints: number;
  consistencyPoints: number;
  autonomyPoints: number;
  streak: number;
  badges: Badge[];
  weeklyProgress: WeeklyDay[];
  dailyMissions: Mission[];
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
  quality: "costanza" | "coraggio" | "curiosità" | "miglioramento" | "autonomia";
}

export interface Mission {
  id: string;
  text: string;
  done: boolean;
  points: number;
}

export interface WeeklyDay {
  day: string;
  minutes: number;
  tasks: number;
  autonomy: number; // 0-100
}

export interface RecapItem {
  id: string;
  subject: string;
  concept: string;
  summary: string;
  recallQuestions: string[];
  lastReviewed: string;
  strength: number; // 0-100
}

export const mockTasks: Task[] = [
  {
    id: "1",
    subject: "Matematica",
    title: "Frazioni: La Grande Divisione",
    description: "Esercizi pagina 45, numeri 1-5",
    estimatedMinutes: 15,
    difficulty: 2,
    steps: 3,
    completed: false,
    microSteps: [
      { id: "1a", text: "Leggi la consegna dell'esercizio 1", done: false, hint: "Cosa ti chiede di fare con le frazioni?" },
      { id: "1b", text: "Ricorda la regola: per dividere le frazioni, capovolgi e moltiplica", done: false, hint: "Cosa succede alla seconda frazione?" },
      { id: "1c", text: "Risolvi gli esercizi 1-3 uno alla volta", done: false, hint: "Fai un passo alla volta, non correre" },
      { id: "1d", text: "Controlla i risultati rileggendo ogni passaggio", done: false, hint: "Il risultato ha senso? È più grande o più piccolo di quello che ti aspettavi?" },
      { id: "1e", text: "Completa gli esercizi 4 e 5", done: false, hint: "Ormai conosci il metodo. Prova da solo!" },
    ],
    keyConcepts: [
      "Dividere frazioni = moltiplicare per il reciproco",
      "Il reciproco si ottiene scambiando numeratore e denominatore",
      "Semplificare sempre il risultato finale",
    ],
    recallQuestions: [
      "Come si divide una frazione per un'altra?",
      "Cos'è il reciproco di 3/4?",
      "Perché è importante semplificare?",
    ],
  },
  {
    id: "2",
    subject: "Italiano",
    title: "Comprensione del testo",
    description: "Leggere il brano e rispondere alle domande",
    estimatedMinutes: 20,
    difficulty: 1,
    steps: 4,
    completed: false,
    microSteps: [
      { id: "2a", text: "Leggi il brano una prima volta senza fermarti", done: false, hint: "Non preoccuparti se non capisci tutto subito" },
      { id: "2b", text: "Sottolinea le parole che non conosci", done: false, hint: "Quante sono? Proviamo a capirle dal contesto" },
      { id: "2c", text: "Rileggi e segna l'idea principale di ogni paragrafo", done: false, hint: "Di cosa parla questo pezzo?" },
      { id: "2d", text: "Rispondi alle domande con parole tue", done: false, hint: "Non copiare dal testo, usa le tue parole" },
    ],
    keyConcepts: [
      "L'idea principale è il messaggio più importante del testo",
      "Le parole chiave aiutano a capire il significato generale",
      "Riformulare con parole proprie migliora la comprensione",
    ],
    recallQuestions: [
      "Qual era l'idea principale del brano?",
      "Quali parole nuove hai imparato oggi?",
      "Riesci a riassumere il testo in 2 frasi?",
    ],
  },
  {
    id: "3",
    subject: "Scienze",
    title: "Il ciclo dell'acqua",
    description: "Studiare paragrafo 3 e fare lo schema",
    estimatedMinutes: 15,
    difficulty: 2,
    steps: 2,
    completed: true,
    microSteps: [
      { id: "3a", text: "Leggi il paragrafo 3 con attenzione", done: true },
      { id: "3b", text: "Identifica le 4 fasi del ciclo dell'acqua", done: true },
      { id: "3c", text: "Disegna uno schema con frecce tra le fasi", done: true },
    ],
    keyConcepts: [
      "Evaporazione: l'acqua diventa vapore",
      "Condensazione: il vapore diventa nuvole",
      "Precipitazione: l'acqua cade come pioggia",
      "Raccolta: l'acqua torna nei fiumi e nel mare",
    ],
    recallQuestions: [
      "Quali sono le 4 fasi del ciclo dell'acqua?",
      "Cosa succede durante l'evaporazione?",
      "Perché il ciclo si chiama 'ciclo'?",
    ],
  },
  {
    id: "4",
    subject: "Storia",
    title: "I Romani: la Repubblica",
    description: "Riassunto pagine 78-82",
    estimatedMinutes: 25,
    difficulty: 3,
    steps: 5,
    completed: false,
    microSteps: [
      { id: "4a", text: "Leggi le pagine 78-79 e segna le date importanti", done: false, hint: "Cerca le date scritte in grassetto" },
      { id: "4b", text: "Chi governava la Repubblica? Scrivi i ruoli principali", done: false, hint: "Consoli, senatori... chi altri?" },
      { id: "4c", text: "Leggi le pagine 80-82 sulle conquiste", done: false, hint: "Dove si espandeva Roma?" },
      { id: "4d", text: "Scrivi un riassunto di 5-6 righe", done: false, hint: "Usa le date e i nomi che hai segnato" },
      { id: "4e", text: "Rileggi il riassunto e chiediti: ho capito tutto?", done: false, hint: "C'è qualcosa che non ti è chiaro?" },
    ],
    keyConcepts: [
      "La Repubblica romana fu fondata nel 509 a.C.",
      "Due consoli governavano insieme per un anno",
      "Il Senato era l'assemblea più importante",
      "Roma conquistò tutta la penisola italiana",
    ],
    recallQuestions: [
      "Quando è nata la Repubblica romana?",
      "Perché c'erano due consoli e non uno solo?",
      "Quali territori ha conquistato Roma durante la Repubblica?",
    ],
  },
];

export const mockGamification: GamificationData = {
  focusPoints: 245,
  consistencyPoints: 180,
  autonomyPoints: 120,
  streak: 4,
  badges: [
    { id: "b1", name: "Prima Fiamma", emoji: "flame", description: "Hai completato la tua prima sessione di focus", earned: true, earnedDate: "2026-03-11", quality: "coraggio" },
    { id: "b2", name: "Costante come il Sole", emoji: "sun", description: "3 giorni consecutivi di studio", earned: true, earnedDate: "2026-03-13", quality: "costanza" },
    { id: "b3", name: "Esploratore Curioso", emoji: "search", description: "Hai chiesto 'perche?' al coach 5 volte", earned: true, earnedDate: "2026-03-14", quality: "curiosita" },
    { id: "b4", name: "Campione di Autonomia", emoji: "sprout", description: "Hai completato 3 compiti senza chiedere aiuto", earned: false, quality: "autonomia" },
    { id: "b5", name: "Mente Critica", emoji: "lightbulb", description: "Hai trovato un errore nel tuo ragionamento e l'hai corretto", earned: false, quality: "miglioramento" },
    { id: "b6", name: "Settimana d'Oro", emoji: "star", description: "5 giorni consecutivi di studio", earned: false, quality: "costanza" },
  ],
  weeklyProgress: [
    { day: "Lun", minutes: 35, tasks: 3, autonomy: 60 },
    { day: "Mar", minutes: 45, tasks: 4, autonomy: 65 },
    { day: "Mer", minutes: 20, tasks: 2, autonomy: 70 },
    { day: "Gio", minutes: 50, tasks: 5, autonomy: 75 },
    { day: "Ven", minutes: 30, tasks: 3, autonomy: 72 },
    { day: "Sab", minutes: 15, tasks: 1, autonomy: 80 },
    { day: "Dom", minutes: 0, tasks: 0, autonomy: 0 },
  ],
  dailyMissions: [
    { id: "m1", text: "Completa una sessione di focus", done: true, points: 10 },
    { id: "m2", text: "Spiega un concetto con parole tue", done: false, points: 15 },
    { id: "m3", text: "Inizia un compito difficile", done: false, points: 20 },
  ],
};

export const mockRecapItems: RecapItem[] = [
  {
    id: "r1",
    subject: "Scienze",
    concept: "Il ciclo dell'acqua",
    summary: "L'acqua sulla Terra si muove continuamente in un ciclo: evapora dal mare, forma le nuvole, cade come pioggia e torna nei fiumi e nel mare.",
    recallQuestions: [
      "Quali sono le 4 fasi del ciclo dell'acqua?",
      "Cosa succede durante la condensazione?",
      "Dove va l'acqua dopo che piove?",
    ],
    lastReviewed: "2026-03-14",
    strength: 85,
  },
  {
    id: "r2",
    subject: "Matematica",
    concept: "Le frazioni equivalenti",
    summary: "Due frazioni sono equivalenti quando rappresentano la stessa quantità. Per trovarle, moltiplica o dividi numeratore e denominatore per lo stesso numero.",
    recallQuestions: [
      "Come fai a sapere se due frazioni sono equivalenti?",
      "Qual è una frazione equivalente a 2/4?",
      "Perché 1/2 e 3/6 sono la stessa cosa?",
    ],
    lastReviewed: "2026-03-12",
    strength: 60,
  },
  {
    id: "r3",
    subject: "Storia",
    concept: "La caduta dell'Impero Romano",
    summary: "L'Impero Romano d'Occidente cadde nel 476 d.C. Le cause principali furono le invasioni barbariche, la crisi economica e la debolezza dell'esercito.",
    recallQuestions: [
      "Quando è caduto l'Impero Romano d'Occidente?",
      "Quali furono le cause principali della caduta?",
      "Chi erano i 'barbari'?",
    ],
    lastReviewed: "2026-03-10",
    strength: 45,
  },
  {
    id: "r4",
    subject: "Italiano",
    concept: "I tempi verbali: passato prossimo",
    summary: "Il passato prossimo si forma con l'ausiliare (essere o avere) + il participio passato. Si usa per azioni concluse nel passato che hanno un legame con il presente.",
    recallQuestions: [
      "Come si forma il passato prossimo?",
      "Quando si usa 'essere' e quando 'avere'?",
      "Fai un esempio con il verbo 'andare'",
    ],
    lastReviewed: "2026-03-08",
    strength: 30,
  },
];

export const subjectColors: Record<string, { bg: string; text: string; badge: string }> = {
  Matematica: { bg: "bg-sage-light", text: "text-sage-dark", badge: "bg-sage-light text-sage-dark" },
  Italiano: { bg: "bg-clay-light", text: "text-clay-dark", badge: "bg-clay-light text-clay-dark" },
  Scienze: { bg: "bg-accent", text: "text-accent-foreground", badge: "bg-accent text-accent-foreground" },
  Storia: { bg: "bg-terracotta-light", text: "text-terracotta", badge: "bg-terracotta-light text-terracotta" },
  Geografia: { bg: "bg-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  Inglese: { bg: "bg-sage-light", text: "text-sage-dark", badge: "bg-sage-light text-sage-dark" },
};
