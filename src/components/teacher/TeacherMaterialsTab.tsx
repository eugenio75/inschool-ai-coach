import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, Sparkles, Upload, ArrowLeft, Send, Download,
  FileText, Trash2, CalendarIcon, BookOpen, Eye, Archive, RotateCcw, Pencil,
  Loader2, AlertCircle, CheckCircle2, Lock, ChevronRight, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { formatMaterialContent } from "@/components/teacher/SharedMaterialsList";
import SharedMaterialsList from "@/components/teacher/SharedMaterialsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { renderAndPrintPdf, splitTeacherContent } from "@/lib/pdfExport";
import { useIsMobile } from "@/hooks/use-mobile";

const ACTIVITY_TYPES = ["lezione", "compito", "verifica", "esercizi", "recupero", "potenziamento"] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];

// Subject-specific examples for contextual placeholders
const SUBJECT_EXAMPLES_A: Record<string, Partial<Record<ActivityType, string>>> = {
  Italiano: {
    compito: "Es. Leggi il brano a pagina 34 e rispondi alle domande 1, 2 e 3 sul quaderno.",
    verifica: "Es. Parte A — 5 domande aperte sui Promessi Sposi. Parte B — 5 domande a scelta multipla. Tempo: 45 minuti.",
    esercizi: "Es. Analisi grammaticale delle frasi a pagina 52, esercizi 5, 6 e 7.",
    recupero: "Es. Rileggi il paragrafo 3.2 e riscrivi con parole tue le 3 regole principali della sintassi.",
    potenziamento: "Es. Scrivi un racconto breve (max 300 parole) usando almeno 3 figure retoriche studiate.",
  },
  Matematica: {
    compito: "Es. Risolvi le equazioni a pagina 45, numeri 1-5. Mostra il procedimento.",
    verifica: "Es. 5 esercizi sulle equazioni di secondo grado + 3 problemi applicativi. Tempo: 50 minuti.",
    esercizi: "Es. Completa gli esercizi sulle frazioni a pagina 52, dal numero 5 al 10.",
    recupero: "Es. Ripassa la differenza tra area e perimetro con gli esercizi guidati a pagina 30.",
    potenziamento: "Es. Risolvi i problemi 8, 9 e 10 a pagina 78. Per il problema 10 spiega il ragionamento usato.",
  },
  Scienze: {
    compito: "Es. Leggi il capitolo sulla cellula e completa la scheda di laboratorio.",
    verifica: "Es. 8 domande misto aperto/chiuso sull'apparato circolatorio. Tempo: 40 minuti.",
    esercizi: "Es. Completa lo schema del ciclo dell'acqua e rispondi alle domande di comprensione.",
    recupero: "Es. Ripassa i 5 regni dei viventi con la mappa concettuale guidata.",
    potenziamento: "Es. Progetta un esperimento per dimostrare l'osmosi, descrivi ipotesi, materiali e procedimento.",
  },
  Storia: {
    compito: "Es. Leggi le pagine 56-60 sulla Rivoluzione Francese e rispondi alle domande.",
    verifica: "Es. 5 domande aperte + 5 a scelta multipla sulla Seconda Guerra Mondiale. Tempo: 45 minuti.",
    esercizi: "Es. Completa la linea del tempo del Risorgimento italiano con le date principali.",
    recupero: "Es. Rileggi il paragrafo sulle cause della Prima Guerra Mondiale e fai uno schema riassuntivo.",
    potenziamento: "Es. Confronta le cause della Rivoluzione Francese e quella Americana in un testo argomentativo.",
  },
  Inglese: {
    compito: "Es. Completa gli esercizi sul Present Perfect a pagina 42, numeri 1-4.",
    verifica: "Es. Reading comprehension + grammar exercises + short writing. Tempo: 50 minuti.",
    esercizi: "Es. Fill in the blanks con il Past Simple o il Present Perfect, esercizi 3-6.",
    recupero: "Es. Ripassa i verbi irregolari con la tabella e completa gli esercizi guidati.",
    potenziamento: "Es. Write a short essay (150 words) about your favourite book, using at least 3 conditional sentences.",
  },
  Musica: {
    compito: "Es. Ascolta il brano 'Le quattro stagioni' di Vivaldi e rispondi alle domande sulla struttura.",
    verifica: "Es. Riconoscimento di 5 strumenti musicali + 3 domande sulla notazione. Tempo: 40 minuti.",
    esercizi: "Es. Scrivi sul pentagramma le note della scala di Do maggiore, ascendente e discendente.",
    recupero: "Es. Ripassa i valori delle note (semibreve, minima, semiminima) con gli esercizi guidati.",
    potenziamento: "Es. Componi una breve melodia di 8 battute usando almeno 3 figure ritmiche diverse.",
  },
  "Educazione Civica": {
    compito: "Es. Leggi l'articolo 3 della Costituzione e spiega con parole tue il principio di uguaglianza.",
    verifica: "Es. 5 domande aperte sui diritti fondamentali + 5 a scelta multipla sull'ordinamento dello Stato. Tempo: 40 minuti.",
    esercizi: "Es. Collega ogni articolo della Costituzione al diritto corrispondente. Completa la tabella.",
    recupero: "Es. Rileggi gli articoli 1-12 e fai uno schema dei principi fondamentali della Repubblica.",
    potenziamento: "Es. Scrivi un testo argomentativo (300 parole) su un tema di attualità legato ai diritti civili.",
  },
  Geografia: {
    compito: "Es. Studia le regioni dell'Italia settentrionale e completa la cartina muta.",
    verifica: "Es. 5 domande aperte + cartina da completare sull'Europa fisica. Tempo: 45 minuti.",
    esercizi: "Es. Individua sulla cartina i principali fiumi e laghi italiani e scrivi il nome accanto.",
    recupero: "Es. Ripassa la differenza tra clima continentale e mediterraneo con la scheda guidata.",
    potenziamento: "Es. Confronta due Paesi europei analizzando territorio, clima, economia e popolazione.",
  },
  Francese: {
    compito: "Es. Completa gli esercizi sul passé composé a pagina 38, numeri 1-5.",
    verifica: "Es. Compréhension écrite + grammaire + production écrite. Temps: 50 minutes.",
    esercizi: "Es. Conjugue les verbes au présent et au passé composé, exercices 3-6.",
    recupero: "Es. Ripassa gli articoli partitivi con la tabella e completa gli esercizi guidati.",
    potenziamento: "Es. Écris un texte de 100 mots sur tes vacances en utilisant au moins 5 verbes au passé composé.",
  },
  Spagnolo: {
    compito: "Es. Completa los ejercicios sobre el pretérito indefinido, página 44, números 1-4.",
    verifica: "Es. Comprensión lectora + gramática + producción escrita. Tiempo: 50 minutos.",
    esercizi: "Es. Conjuga los verbos en presente y pretérito, ejercicios 3-6.",
    recupero: "Es. Ripassa ser vs estar con la tabella e completa gli esercizi guidati.",
    potenziamento: "Es. Escribe un texto de 100 palabras sobre tu ciudad usando al menos 5 verbos en pasado.",
  },
  Tedesco: {
    compito: "Es. Completa gli esercizi sui casi (Nominativ, Akkusativ) a pagina 40, numeri 1-4.",
    verifica: "Es. Leseverständnis + Grammatik + kurzer Aufsatz. Zeit: 50 Minuten.",
    esercizi: "Es. Ergänze die Sätze mit dem richtigen Artikel (der, die, das), Übungen 3-6.",
    recupero: "Es. Ripassa i verbi separabili con la tabella e completa gli esercizi guidati.",
    potenziamento: "Es. Schreibe einen kurzen Text (100 Wörter) über dein Hobby mit mindestens 5 Verben.",
  },
  Arte: {
    compito: "Es. Osserva l'opera 'La notte stellata' di Van Gogh e rispondi alle domande di analisi.",
    verifica: "Es. 5 domande aperte sul Rinascimento + analisi di un'opera d'arte. Tempo: 45 minuti.",
    esercizi: "Es. Realizza uno schizzo usando la tecnica del chiaroscuro studiata in classe.",
    recupero: "Es. Ripassa le differenze tra arte romanica e gotica con la scheda illustrata.",
    potenziamento: "Es. Confronta due opere dello stesso periodo e analizza stile, tecnica e significato.",
  },
  "Educazione Fisica": {
    compito: "Es. Scrivi una relazione sulle regole della pallavolo e i fondamentali di gioco.",
    verifica: "Es. 5 domande aperte sull'apparato locomotore + 5 a scelta multipla sull'alimentazione sportiva.",
    esercizi: "Es. Descrivi una sequenza di 5 esercizi di riscaldamento indicando muscoli coinvolti.",
    recupero: "Es. Ripassa i concetti di frequenza cardiaca e zona aerobica con la scheda guidata.",
    potenziamento: "Es. Progetta un circuito di allenamento di 20 minuti per migliorare la resistenza.",
  },
  Tecnologia: {
    compito: "Es. Disegna la pianta della tua aula in scala 1:50 usando riga e squadra.",
    verifica: "Es. 5 domande aperte sui materiali + lettura di un disegno tecnico. Tempo: 45 minuti.",
    esercizi: "Es. Completa la tabella comparativa dei materiali (legno, metallo, plastica, vetro).",
    recupero: "Es. Ripassa le proiezioni ortogonali con gli esercizi guidati a pagina 28.",
    potenziamento: "Es. Progetta un oggetto di uso quotidiano e realizza il disegno tecnico con le tre viste.",
  },
  Filosofia: {
    compito: "Es. Leggi il brano di Platone e rispondi alle domande sul mito della caverna.",
    verifica: "Es. 4 domande aperte su Kant + analisi di un passo dell'opera. Tempo: 50 minuti.",
    esercizi: "Es. Confronta le posizioni di empirismo e razionalismo in una tabella sinottica.",
    recupero: "Es. Ripassa il pensiero di Socrate con la mappa concettuale guidata.",
    potenziamento: "Es. Scrivi un saggio breve (400 parole) sulla differenza tra etica kantiana e utilitarismo.",
  },
  Fisica: {
    compito: "Es. Risolvi i problemi sulle leggi di Newton a pagina 62, numeri 1-4.",
    verifica: "Es. 5 problemi sulla cinematica + 3 domande teoriche sulla dinamica. Tempo: 50 minuti.",
    esercizi: "Es. Converti le unità di misura e calcola velocità media negli esercizi 5-8.",
    recupero: "Es. Ripassa la differenza tra velocità e accelerazione con gli esercizi guidati.",
    potenziamento: "Es. Risolvi il problema del piano inclinato con attrito e commenta il procedimento.",
  },
  Chimica: {
    compito: "Es. Bilancia le reazioni chimiche a pagina 48, numeri 1-6.",
    verifica: "Es. 5 esercizi sul bilanciamento + 3 domande sulla tavola periodica. Tempo: 45 minuti.",
    esercizi: "Es. Calcola la massa molare dei composti indicati e completa la tabella.",
    recupero: "Es. Ripassa la differenza tra legame ionico e covalente con la scheda guidata.",
    potenziamento: "Es. Progetta un esperimento per verificare la legge di Lavoisier e descrivi il procedimento.",
  },
  Latino: {
    compito: "Es. Traduci il brano di Cesare a pagina 56 e fai l'analisi del periodo.",
    verifica: "Es. Traduzione dal latino + 3 domande di grammatica sulla 3ª declinazione. Tempo: 50 minuti.",
    esercizi: "Es. Declina i sostantivi della 2ª declinazione e completa le frasi con la forma corretta.",
    recupero: "Es. Ripassa le desinenze della 1ª e 2ª declinazione con la tabella e gli esercizi guidati.",
    potenziamento: "Es. Traduci il passo di Cicerone e confronta due traduzioni d'autore commentando le scelte.",
  },
  Informatica: {
    compito: "Es. Scrivi un programma che calcoli la media di 5 numeri inseriti dall'utente.",
    verifica: "Es. 3 esercizi di programmazione + 4 domande sulla logica booleana. Tempo: 50 minuti.",
    esercizi: "Es. Completa la tabella di verità per AND, OR e NOT con 3 variabili.",
    recupero: "Es. Ripassa il concetto di variabile e ciclo con gli esercizi guidati passo-passo.",
    potenziamento: "Es. Crea un algoritmo di ordinamento e confronta la complessità di due approcci diversi.",
  },
  Religione: {
    compito: "Es. Leggi il brano del Vangelo proposto e rispondi alle domande di riflessione.",
    verifica: "Es. 5 domande aperte sulle religioni monoteiste + confronto tra tradizioni. Tempo: 40 minuti.",
    esercizi: "Es. Completa la tabella comparativa delle tre religioni abramitiche.",
    recupero: "Es. Ripassa i concetti fondamentali del Cristianesimo con la mappa concettuale.",
    potenziamento: "Es. Scrivi una riflessione personale (300 parole) su un valore etico a tua scelta.",
  },
  Greco: {
    compito: "Es. Traduci il brano di Senofonte a pagina 42 e fai l'analisi morfosintattica.",
    verifica: "Es. Traduzione dal greco + 3 domande sulla 3ª declinazione attica. Tempo: 50 minuti.",
    esercizi: "Es. Coniuga i verbi contratti al presente indicativo attivo e medio-passivo.",
    recupero: "Es. Ripassa l'articolo greco e la 1ª declinazione con la tabella e gli esercizi guidati.",
    potenziamento: "Es. Traduci il passo di Platone e commenta le scelte lessicali nel contesto filosofico.",
  },
  Diritto: {
    compito: "Es. Leggi gli articoli 1-5 della Costituzione e spiega i principi fondamentali.",
    verifica: "Es. 5 domande aperte sul diritto civile + 5 a scelta multipla. Tempo: 45 minuti.",
    esercizi: "Es. Analizza il caso proposto e individua le norme giuridiche applicabili.",
    recupero: "Es. Ripassa la differenza tra diritto pubblico e privato con lo schema riassuntivo.",
    potenziamento: "Es. Scrivi una memoria difensiva per il caso simulato proposto in classe.",
  },
  Economia: {
    compito: "Es. Leggi il paragrafo sulla domanda e offerta e rispondi alle domande.",
    verifica: "Es. 4 domande aperte + 2 esercizi di calcolo su PIL e inflazione. Tempo: 45 minuti.",
    esercizi: "Es. Costruisci il grafico domanda-offerta con i dati della tabella a pagina 38.",
    recupero: "Es. Ripassa i concetti di costo fisso e variabile con la scheda guidata.",
    potenziamento: "Es. Analizza un articolo di giornale economico e scrivi un commento critico (300 parole).",
  },
  Biologia: {
    compito: "Es. Studia il capitolo sulla genetica mendeliana e completa la scheda sugli incroci.",
    verifica: "Es. 5 domande aperte sulla cellula + 3 esercizi sulla genetica. Tempo: 45 minuti.",
    esercizi: "Es. Risolvi i problemi sugli incroci monoibridi usando il quadrato di Punnett.",
    recupero: "Es. Ripassa la differenza tra mitosi e meiosi con la tabella comparativa.",
    potenziamento: "Es. Progetta un esperimento sulla fermentazione e descrivi variabili e risultati attesi.",
  },
};

const SUBJECT_EXAMPLES_B: Record<string, Partial<Record<ActivityType, string>>> = {
  Italiano: {
    lezione: "Es. Una lezione di 50 minuti sulla struttura del testo narrativo — con aggancio motivazionale, attività in classe e verifica di comprensione.",
    compito: "Es. Un compito di comprensione del testo — brano di narrativa con 5 domande aperte, livello medio.",
    verifica: "Es. Una verifica sui Promessi Sposi, 8 domande misto aperto e chiuso, con soluzione, difficoltà media.",
  },
  Matematica: {
    lezione: "Es. Una lezione di 50 minuti sulle equazioni di secondo grado — con esempi guidati, esercizi in classe e compito per casa.",
    compito: "Es. 5 esercizi sulle frazioni con procedimento guidato, livello medio.",
    verifica: "Es. Una verifica sulle equazioni, 8 esercizi a difficoltà crescente, con soluzioni, tempo 50 minuti.",
  },
  Scienze: {
    lezione: "Es. Una lezione di 50 minuti sulla cellula — con immagini, esperimento pratico e quiz finale.",
    compito: "Es. Una scheda sulla fotosintesi con domande di comprensione e uno schema da completare.",
    verifica: "Es. Una verifica sull'apparato digerente, 6 domande aperte + 4 a scelta multipla, con soluzioni.",
  },
  Storia: {
    lezione: "Es. Una lezione di 50 minuti sulla Rivoluzione Francese — con aggancio motivazionale, attività in classe e verifica di comprensione.",
    compito: "Es. Un compito sulla Seconda Guerra Mondiale con 5 domande aperte e una linea del tempo da completare.",
    verifica: "Es. Una verifica sul Risorgimento, 8 domande misto aperto e chiuso, con soluzione, difficoltà media.",
  },
  Inglese: {
    lezione: "Es. A 50-minute lesson on the Present Perfect — with warm-up, practice activities and wrap-up.",
    compito: "Es. A reading comprehension task with 5 questions, intermediate level.",
    verifica: "Es. A test on Past Simple vs Present Perfect, 8 exercises, with answer key.",
  },
  Musica: {
    lezione: "Es. Una lezione di 50 minuti sul ritmo — ascolto guidato, body percussion e esecuzione di un ostinato ritmico.",
    compito: "Es. Ascolta il brano assegnato, identifica gli strumenti e scrivi una breve analisi della struttura.",
    verifica: "Es. Una verifica sulla notazione musicale, 6 domande + 2 esercizi di lettura ritmica, con soluzioni.",
  },
  "Educazione Civica": {
    lezione: "Es. Una lezione di 50 minuti sui diritti fondamentali — dalla Costituzione ai casi concreti, con discussione guidata.",
    compito: "Es. Un compito sui principi fondamentali della Costituzione con 5 domande di riflessione, livello medio.",
    verifica: "Es. Una verifica sull'ordinamento dello Stato, 8 domande misto, con soluzione, difficoltà media.",
  },
  Geografia: {
    lezione: "Es. Una lezione di 50 minuti sull'Europa fisica — cartine, video e attività di localizzazione.",
    compito: "Es. Un compito sull'Italia delle regioni con cartina muta da completare e 5 domande.",
    verifica: "Es. Una verifica sui climi europei, 6 domande + cartina da completare, con soluzioni.",
  },
  Francese: {
    lezione: "Es. Une leçon de 50 minutes sur le passé composé — avec exercices pratiques et jeu de rôle.",
    compito: "Es. Un compito di comprensione scritta in francese con 5 domande, livello intermedio.",
    verifica: "Es. Un test sur les articles partitifs et le passé composé, 8 exercices, avec corrigé.",
  },
  Spagnolo: {
    lezione: "Es. Una lección de 50 minutos sobre el pretérito — con ejemplos, actividades y tarea.",
    compito: "Es. Un compito di comprensione scritta in spagnolo con 5 domande, livello intermedio.",
    verifica: "Es. Una prueba sobre ser/estar y pretérito, 8 ejercicios, con soluciones.",
  },
  Tedesco: {
    lezione: "Es. Eine 50-Minuten-Stunde über die Deklination — mit Übungen, Spielen und Hausaufgabe.",
    compito: "Es. Un compito di comprensione scritta in tedesco con 5 domande, livello intermedio.",
    verifica: "Es. Ein Test über Nominativ und Akkusativ, 8 Übungen, mit Lösungen.",
  },
  Arte: {
    lezione: "Es. Una lezione di 50 minuti sul Rinascimento — opere chiave, contesto storico e attività di analisi.",
    compito: "Es. Un'analisi d'opera guidata — osserva, descrivi tecnica e stile, rispondi a 5 domande.",
    verifica: "Es. Una verifica sull'arte medievale, 6 domande + analisi di un'opera, con soluzioni.",
  },
  "Educazione Fisica": {
    lezione: "Es. Una lezione di 50 minuti sulla pallavolo — riscaldamento, fondamentali e partita guidata.",
    compito: "Es. Un compito sull'alimentazione e sport, con 5 domande di riflessione, livello medio.",
    verifica: "Es. Una verifica sull'apparato locomotore, 6 domande + schema da completare, con soluzioni.",
  },
  Tecnologia: {
    lezione: "Es. Una lezione di 50 minuti sul disegno tecnico — proiezioni ortogonali con esercitazione pratica.",
    compito: "Es. Un compito di disegno tecnico — pianta in scala 1:50 con quotature.",
    verifica: "Es. Una verifica sui materiali, 6 domande + lettura di un disegno tecnico, con soluzioni.",
  },
  Filosofia: {
    lezione: "Es. Una lezione di 50 minuti su Platone — il mito della caverna con discussione guidata e attività.",
    compito: "Es. Un compito di analisi testuale — leggi il brano di Aristotele e rispondi a 5 domande.",
    verifica: "Es. Una verifica su Kant, 4 domande aperte + analisi di un passo, con soluzioni.",
  },
  Fisica: {
    lezione: "Es. Una lezione di 50 minuti sulle leggi di Newton — esperimenti dimostrativi e problemi guidati.",
    compito: "Es. 5 problemi sulla cinematica con procedimento guidato, livello medio.",
    verifica: "Es. Una verifica sulla dinamica, 5 problemi + 3 domande teoriche, con soluzioni, tempo 50 min.",
  },
  Chimica: {
    lezione: "Es. Una lezione di 50 minuti sul legame chimico — modelli molecolari, esempi e quiz interattivo.",
    compito: "Es. 5 esercizi di bilanciamento delle reazioni con procedimento guidato, livello medio.",
    verifica: "Es. Una verifica sulla tavola periodica, 6 esercizi + 2 domande aperte, con soluzioni.",
  },
  Latino: {
    lezione: "Es. Una lezione di 50 minuti sulla 3ª declinazione — spiegazione, paradigmi e versione guidata.",
    compito: "Es. Una versione di Cesare con analisi del periodo e 3 domande di comprensione.",
    verifica: "Es. Una verifica sulla 2ª declinazione, traduzione + grammatica, con soluzioni, tempo 50 min.",
  },
  Informatica: {
    lezione: "Es. Una lezione di 50 minuti sugli algoritmi — pseudocodice, flowchart e esercizio pratico di coding.",
    compito: "Es. Un esercizio di programmazione — scrivi una funzione che ordini un array, con test.",
    verifica: "Es. Una verifica sulla logica booleana, 3 esercizi + 4 domande teoriche, con soluzioni.",
  },
  Biologia: {
    lezione: "Es. Una lezione di 50 minuti sulla genetica — leggi di Mendel con esercizi guidati e quadrato di Punnett.",
    compito: "Es. 5 problemi di genetica con quadrato di Punnett, livello medio.",
    verifica: "Es. Una verifica sulla cellula, 6 domande + schema da completare, con soluzioni.",
  },
};

function getPlaceholderA(type: ActivityType, subjects: string[]): string {
  const defaults: Record<ActivityType, string> = {
    lezione: "Es. Scrivi qui la tua scaletta di lezione completa — introduzione, corpo, attività, sintesi e compito per casa.",
    compito: "Es. Leggi il brano a pagina 34 e rispondi alle domande 1, 2 e 3 sul quaderno.",
    verifica: "Es. Parte A — 5 domande aperte. Parte B — 5 domande a scelta multipla. Tempo: 45 minuti.",
    esercizi: "Es. Completa gli esercizi 5, 6 e 7 a pagina 52. Mostra il procedimento per ogni calcolo.",
    recupero: "Es. Rileggi il paragrafo 3.2 e riscrivi con parole tue le 3 regole principali. Poi fai i primi 3 esercizi.",
    potenziamento: "Es. Risolvi i problemi 8, 9 e 10 a pagina 78. Per il problema 10 spiega il ragionamento usato.",
  };
  const subj = subjects[0];
  if (subj && SUBJECT_EXAMPLES_A[subj]?.[type]) return SUBJECT_EXAMPLES_A[subj][type]!;
  return defaults[type];
}

function getPlaceholderB(type: ActivityType, subjects: string[], className: string): string {
  const defaults: Record<ActivityType, string> = {
    lezione: `Es. Una lezione di 50 minuti${className ? ` per ${className}` : ""} — con aggancio motivazionale, attività in classe e verifica di comprensione.`,
    compito: `Es. Un compito${className ? ` per ${className}` : ""} — con domande aperte, livello medio.`,
    verifica: `Es. Una verifica${className ? ` per ${className}` : ""}, 8 domande misto aperto e chiuso, con soluzione, difficoltà media.`,
    esercizi: `Es. 5 esercizi${className ? ` per ${className}` : ""} con procedimento guidato, livello medio.`,
    recupero: `Es. Una scheda di recupero${className ? ` per ${className}` : ""} — spiegazione semplice, 3 esempi pratici, 4 esercizi facili.`,
    potenziamento: `Es. 3 problemi avanzati${className ? ` per ${className}` : ""} per chi ha già acquisito le basi, con soluzione commentata.`,
  };
  const subj = subjects[0];
  if (subj && SUBJECT_EXAMPLES_B[subj]?.[type]) {
    let ph = SUBJECT_EXAMPLES_B[subj][type]!;
    if (className && !ph.includes(className)) {
      ph = ph.replace("Es. ", `Es. [${className}] `);
    }
    return ph;
  }
  return defaults[type];
}

function normalizeSubjects(subjects: Array<string | null | undefined>): string[] {
  return [...new Set(subjects.map((subject) => subject?.trim()).filter(Boolean) as string[])];
}

function parseSubjects(subjects?: string | null): string[] {
  return normalizeSubjects((subjects || "").split(","));
}

function resolveDefaultSubjects(classSubjects: string[], teacherSubjects: string[]): string[] {
  const normalizedClassSubjects = normalizeSubjects(classSubjects);
  const normalizedTeacherSubjects = normalizeSubjects(teacherSubjects);

  if (normalizedTeacherSubjects.length === 0) return normalizedClassSubjects;
  if (normalizedClassSubjects.length === 0) return normalizedTeacherSubjects;

  const teacherSubjectsSet = new Set(normalizedTeacherSubjects.map((subject) => subject.toLowerCase()));
  const overlappingSubjects = normalizedClassSubjects.filter((subject) => teacherSubjectsSet.has(subject.toLowerCase()));

  return overlappingSubjects.length > 0 ? overlappingSubjects : normalizedTeacherSubjects;
}

type FormMode = null | "write" | "ai" | "file";
type DestinationType = "all" | "selected" | "pdf";

export interface PrefilledMaterial {
  tipo_attivita: string;
  materia: string;
  argomento: string;
  descrizione: string;
  studentIds?: string[];
}

interface Props {
  classId: string;
  classe: any;
  students: any[];
  materials: any[];
  userId: string;
  onReload: () => void;
  autoCreate?: boolean;
  hideSaved?: boolean;
  prefilledMaterial?: PrefilledMaterial | null;
}

const MATERIE_OPTIONS_BASE = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese",
  "Francese", "Spagnolo", "Tedesco", "Arte", "Musica", "Educazione Fisica",
  "Tecnologia", "Religione", "Filosofia", "Fisica", "Chimica", "Biologia",
  "Informatica", "Latino", "Greco", "Diritto", "Economia",
];

export default function TeacherMaterialsTab({ classId, classe, students, materials: propMaterials, userId, onReload, autoCreate, hideSaved, prefilledMaterial }: Props) {
  // Local materials state + adapted map for SharedMaterialsList
  const [localMaterials, setLocalMaterials] = useState<any[]>([]);
  const [adaptedMap, setAdaptedMap] = useState<Record<string, Record<string, any>>>({});
  const [classiList, setClassiList] = useState<any[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [coachName, setCoachName] = useState("");

  // Fetch teacher's subjects from user_preferences (onboarding data)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      // Find teacher's profile id
      const { data: profiles } = await supabase
        .from("child_profiles")
        .select("id, favorite_subjects")
        .eq("parent_id", userId)
        .eq("school_level", "docente")
        .limit(1);
      const profile = profiles?.[0];
      const profileId = profile?.id;
      if (!profileId) return;
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("data")
        .eq("profile_id", profileId)
        .maybeSingle();
      const prefsData = (prefs?.data as any) || {};
      const profileSubjects = normalizeSubjects(profile?.favorite_subjects || []);
      const preferenceSubjects = normalizeSubjects(prefsData.docente_materie || []);
      const subjects = profileSubjects.length > 0 ? profileSubjects : preferenceSubjects;
      if (subjects.length > 0) setTeacherSubjects(subjects);
      setCoachName(typeof prefsData.coach_name === "string" ? prefsData.coach_name.trim() : "");
    })();
  }, [userId]);

  const classSubjects = useMemo(() => parseSubjects(classe?.materia), [classe?.materia]);
  const defaultSubjects = useMemo(
    () => resolveDefaultSubjects(classSubjects, teacherSubjects),
    [classSubjects, teacherSubjects]
  );
  const coachGeneratorLabel = coachName ? `Genera con ${coachName}` : "Genera con AI";
  const isMobile = useIsMobile();

  // Build MATERIE_OPTIONS with teacher's subjects prioritized at top
  const MATERIE_OPTIONS = useMemo(() => {
    const extra = teacherSubjects.filter(s => !MATERIE_OPTIONS_BASE.includes(s));
    const ordered = [...teacherSubjects, ...MATERIE_OPTIONS_BASE.filter(s => !teacherSubjects.includes(s)), ...extra.filter(s => !teacherSubjects.includes(s))];
    return [...new Set(ordered)];
  }, [teacherSubjects]);

  useEffect(() => {
    // Separate parent materials from adapted children
    const parents: any[] = [];
    const adaptedByParent: Record<string, Record<string, any>> = {};
    propMaterials.forEach((m: any) => {
      if (m.target_profile && ["bes", "dsa", "h"].includes(m.target_profile) && m.parent_material_id) {
        if (!adaptedByParent[m.parent_material_id]) adaptedByParent[m.parent_material_id] = {};
        adaptedByParent[m.parent_material_id][m.target_profile] = m;
      } else if (m.target_profile !== "docente") {
        parents.push(m);
      }
    });
    setLocalMaterials(parents);
    setAdaptedMap(adaptedByParent);
  }, [propMaterials]);

  useEffect(() => {
    supabase.from("classi").select("id, nome").order("nome").then(({ data }) => setClassiList(data || []));
  }, []);

  const classMap = useMemo(() => {
    const m: Record<string, string> = {};
    classiList.forEach(c => { m[c.id] = c.nome; });
    if (classe?.id && classe?.nome) m[classe.id] = classe.nome;
    return m;
  }, [classiList, classe]);
  const [mode, setMode] = useState<FormMode>(null);
  const [activityType, setActivityType] = useState<ActivityType>("compito");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [destination, setDestination] = useState<DestinationType>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [didCustomizeSubjects, setDidCustomizeSubjects] = useState(false);

  useEffect(() => {
    if (!didCustomizeSubjects) {
      setSelectedSubjects(defaultSubjects);
    }
  }, [defaultSubjects, didCustomizeSubjects]);

  // Handle prefilled material from lacune alerts
  useEffect(() => {
    if (!prefilledMaterial) return;
    setMode("ai");
    setActivityType((prefilledMaterial.tipo_attivita || "recupero") as ActivityType);
    if (prefilledMaterial.materia) {
      setSelectedSubjects([prefilledMaterial.materia]);
      setDidCustomizeSubjects(true);
    }
    setAiPrompt(prefilledMaterial.descrizione || "");
    if (prefilledMaterial.studentIds && prefilledMaterial.studentIds.length > 0) {
      setDestination("selected");
      setSelectedStudents(prefilledMaterial.studentIds);
    }
  }, [prefilledMaterial]);

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiSolutions, setAiSolutions] = useState<string | null>(null);
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const [aiContextFile, setAiContextFile] = useState<File | null>(null);
  const [aiContextText, setAiContextText] = useState<string | null>(null);
  const [aiContextUploading, setAiContextUploading] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // === Type-specific fields ===
  // Lezione
  const [durataLezione, setDurataLezione] = useState("60 min");
  const [durataLezioneCustom, setDurataLezioneCustom] = useState("");
  const [obiettivoLezione, setObiettivoLezione] = useState("");
  // Verifica
  const [numDomande, setNumDomande] = useState("10");
  const [numDomandeCustom, setNumDomandeCustom] = useState("");
  const [struttura, setStruttura] = useState("Mista aperte+chiuse");
  const [punteggioTotale, setPunteggioTotale] = useState("10");
  const [punteggioCustom, setPunteggioCustom] = useState("");
  const [tempoDisponibile, setTempoDisponibile] = useState("45 min");
  // Compito
  const [tipoConsegna, setTipoConsegna] = useState("Misto");
  const [tempoStimato, setTempoStimato] = useState("30 min");
  // Esercizi
  const [numEsercizi, setNumEsercizi] = useState("10");
  const [numEserciziCustom, setNumEserciziCustom] = useState("");
  const [difficolta, setDifficolta] = useState("Normale");
  const [includiSoluzioni, setIncludiSoluzioni] = useState("Sì");
  // Recupero
  const [modalitaRecupero, setModalitaRecupero] = useState("Spiegazione + esercizi");
  const [livelloPartenza, setLivelloPartenza] = useState("Argomento specifico");
  // Potenziamento
  const [obiettivoPotenziamento, setObiettivoPotenziamento] = useState("Approfondimento teorico");

  // Inline refinement state
  const [aiRefinePrompt, setAiRefinePrompt] = useState("");
  const [aiRefining, setAiRefining] = useState(false);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Saved materials
  const [materialFilter, setMaterialFilter] = useState("tutti");

  // Adapted versions (BES/DSA/H) state
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [confirmedContent, setConfirmedContent] = useState<string>("");
  const [confirmedTitle, setConfirmedTitle] = useState<string>("");
  const [confirmedSolutions, setConfirmedSolutions] = useState<string | null>(null);
  const [adaptedVersions, setAdaptedVersions] = useState<{ bes: string | null; dsa: string | null; h: string | null }>({ bes: null, dsa: null, h: null });
  const [adaptedLoading, setAdaptedLoading] = useState(false);
  const [adaptedError, setAdaptedError] = useState(false);

  // Preview content modal state (must be before early returns)
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewModalType, setPreviewModalType] = useState<"student" | "teacher">("student");
  const [previewEditMode, setPreviewEditMode] = useState(false);
  const [previewEditText, setPreviewEditText] = useState("");
  const [previewAiEditMode, setPreviewAiEditMode] = useState(false);
  const [previewAiPrompt, setPreviewAiPrompt] = useState("");
  const [previewAiRefining, setPreviewAiRefining] = useState(false);

  function resetForm() {
    setMode(null);
    setActivityType("compito");
    setContent("");
    setDueDate(undefined);
    setDestination("all");
    setSelectedStudents([]);
    setShowPreview(false);
    setAiPrompt("");
    setAiOutput(null);
    setAiSolutions(null);
    setAiTitle(null);
    setAiLoading(false);
    setAiContextFile(null);
    setAiContextText(null);
    setAiRefinePrompt("");
    setAiRefining(false);
    setUploadFile(null);
    setUploadUrl(null);
    setOcrText(null);
    setDidCustomizeSubjects(false);
    setSelectedSubjects(defaultSubjects);
    setShowDownloadPanel(false);
    setConfirmedContent("");
    setConfirmedTitle("");
    setConfirmedSolutions(null);
    setAdaptedVersions({ bes: null, dsa: null, h: null });
    setAdaptedLoading(false);
    setAdaptedError(false);
    setPreviewModalOpen(false);
    setPreviewEditMode(false);
    setPreviewAiEditMode(false);
    setPreviewAiPrompt("");
    setPreviewAiRefining(false);
    // Reset type-specific fields
    setDurataLezione("60 min"); setDurataLezioneCustom(""); setObiettivoLezione("");
    setNumDomande("10"); setNumDomandeCustom("");
    setStruttura("Mista aperte+chiuse");
    setPunteggioTotale("10"); setPunteggioCustom("");
    setTempoDisponibile("45 min");
    setTipoConsegna("Misto"); setTempoStimato("30 min");
    setNumEsercizi("10"); setNumEserciziCustom("");
    setDifficolta("Normale"); setIncludiSoluzioni("Sì");
    setModalitaRecupero("Spiegazione + esercizi"); setLivelloPartenza("Argomento specifico");
    setObiettivoPotenziamento("Approfondimento teorico");
  }

  function getPreviewContent(): string {
    if (mode === "write") return content;
    if (mode === "ai") return aiOutput || "";
    if (mode === "file") return ocrText || "";
    return "";
  }

  function getTitle(): string {
    // Use AI-generated contextual title if available
    if (aiTitle) return aiTitle;
    const previewContent = getPreviewContent();
    if (previewContent) {
      return previewContent.slice(0, 60).replace(/\n/g, " ").trim() || `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} — ${classe?.nome || ""}`;
    }
    return `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} — ${classe?.nome || ""}`;
  }

  // --- File upload for Form C ---
  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadFile(file);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `assignments/${classId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("homework-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("homework-images").getPublicUrl(path);
      setUploadUrl(urlData.publicUrl);
      toast.success("File caricato!");

      // Run OCR for images
      if (file.type.startsWith("image/")) {
        setOcrLoading(true);
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const { data: { session } } = await supabase.auth.getSession();
        const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: [base64] }),
        });
        const ocrData = await ocrRes.json();
        const extracted = ocrData.tasks?.map((t: any) => t.title || t).join("\n") || ocrData.text || "";
        setOcrText(extracted);
        setOcrLoading(false);
      } else {
        const text = await file.text().catch(() => null);
        setOcrText(text || `[Documento: ${file.name}]`);
      }
    } catch (err: any) {
      toast.error("Errore upload: " + (err.message || "Riprova"));
    }
    setUploading(false);
  }

  // --- AI context upload for Form B ---
  async function handleAiContextUpload(file: File) {
    setAiContextUploading(true);
    setAiContextFile(file);
    try {
      if (file.type.startsWith("image/")) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const { data: { session } } = await supabase.auth.getSession();
        const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: [base64] }),
        });
        const ocrData = await ocrRes.json();
        const extracted = ocrData.tasks?.map((t: any) => t.title || t).join("\n") || ocrData.text || "Contenuto estratto dal documento.";
        setAiContextText(extracted);
        toast.success("Documento analizzato!");
      } else {
        const text = await file.text().catch(() => null);
        setAiContextText(text || `[Documento caricato: ${file.name}]`);
        toast.success("Documento caricato!");
      }
    } catch (err: any) {
      toast.error("Errore analisi documento: " + (err.message || "Riprova"));
      setAiContextText(`[Documento: ${file.name}]`);
    }
    setAiContextUploading(false);
  }

  // --- AI generate ---
  async function generateAiContent() {
    if (!aiPrompt.trim() && !aiContextText) {
      toast.error("Descrivi cosa vuoi generare o carica un documento");
      return;
    }
    setAiLoading(true);
    setShowPreview(false);
    setAiOutput(null);
    setAiSolutions(null);
    setAiTitle(null);
    try {
      const subjectStr = selectedSubjects.join(", ") || classe?.materia || "";
      const levelContext = classe?.ordine_scolastico ? `Livello scolastico: ${classe.ordine_scolastico}.` : "";
      const studentsContext = students?.length ? `La classe ha ${students.length} studenti.` : "";

      const resolvedNumDomande = numDomande === "Personalizzato" ? (numDomandeCustom || "10") : numDomande;
      const resolvedPunteggio = punteggioTotale === "Personalizzato" ? (punteggioCustom || "10") : punteggioTotale;
      const resolvedNumEsercizi = numEsercizi === "Personalizzato" ? (numEserciziCustom || "10") : numEsercizi;

      let systemPrompt: string;

      const resolvedDurataLezione = durataLezione === "Personalizzato" ? (durataLezioneCustom || "60 min") : durataLezione;

      if (activityType === "lezione") {
        systemPrompt = `Sei un docente esperto con anni di esperienza in aula. Genera un PIANO DI LEZIONE COMPLETO E DETTAGLIATO. Classe: ${classe?.nome || ""}. Materia: ${subjectStr}. ${levelContext} ${studentsContext}

PARAMETRI:
- Durata: ${resolvedDurataLezione}
${obiettivoLezione ? `- Obiettivo principale: ${obiettivoLezione}` : ""}

REGOLE IMPORTANTI:
1. La PRIMA RIGA del tuo output DEVE essere: TITOLO: [titolo contestuale della lezione, es. "Lezione di Storia — La Rivoluzione Francese"]

2. Il piano di lezione DEVE seguire ESATTAMENTE questa struttura, con titoli chiari per ogni sezione:

### Intestazione
Materia, Classe, Durata stimata, Obiettivi di apprendimento (conoscenze + competenze)

### Prerequisiti
Cosa gli studenti devono già sapere per seguire la lezione

### Introduzione / Aggancio motivazionale (5-10 minuti)
Come aprire la lezione — domanda provocatoria, caso reale, curiosità, collegamento con l'attualità

### Corpo della lezione
Spiegazione COMPLETA e DETTAGLIATA dei contenuti, suddivisa in blocchi tematici con titoli. Ogni blocco deve includere: concetti chiave, esempi concreti, analogie, eventuali errori concettuali comuni da anticipare. MINIMO 600-800 parole per questa sezione — questo è un documento che il docente porta in classe e usa direttamente, NON un riassunto.

### Attività in classe
1-2 attività pratiche o di discussione guidata da fare durante la lezione

### Verifica di comprensione in itinere
3-5 domande rapide (orali o scritte) da fare durante la lezione per capire se la classe sta seguendo

### Sintesi finale
Riepilogo dei punti chiave in forma di mappa o elenco — qualcosa che lo studente può scrivere sul quaderno

### Compito per casa (opzionale)
Breve consolidamento — non una nuova verifica, solo rinforzo

3. DOPO tutto il contenuto per lo studente, inserisci una riga con ESATTAMENTE: ===SOLUZIONI===
4. DOPO il separatore, scrivi la sezione "Note per il docente" che include:
   - Suggerimenti metodologici
   - Possibili domande difficili degli studenti con risposta suggerita
   - Riferimenti a risorse esterne utili (video YouTube, siti educativi, articoli) — Puoi e DEVI includere link a risorse esterne utili (YouTube, siti educativi, articoli) scritti come testo normale nella sezione Note Docente o Risorse. NON incorporare immagini nel documento.
   - Differenziazione per studenti in difficoltà o avanzati
   Questa parte sarà visibile SOLO al docente.

5. Genera contenuto LUNGO e DETTAGLIATO. Il corpo della lezione deve essere esaustivo, pronto per l'uso in aula.`;

      } else if (activityType === "verifica") {
        systemPrompt = `Sei un docente esperto. Genera una VERIFICA COMPLETA per ${classe?.nome || "la classe"}.
Materia: ${subjectStr}. ${levelContext} ${studentsContext}

PARAMETRI:
- Numero domande: ${resolvedNumDomande}
- Struttura: ${struttura}
- Punteggio totale: ${resolvedPunteggio} punti
- Tempo disponibile: ${tempoDisponibile}

REGOLE:
1. La PRIMA RIGA DEVE essere: TITOLO: [titolo verifica]
2. Organizza in sezioni chiare (Sezione A, B, C...) in base alla struttura scelta
3. Ogni domanda riporta il punteggio assegnato
4. Distribuzione difficoltà: 30% facile, 50% medio, 20% difficile
5. Inserisci ===SOLUZIONI=== dopo il contenuto studente
6. Dopo il separatore: risposte corrette, griglia di valutazione con fascia voto, note docente
7. Puoi e DEVI includere link a risorse esterne utili (YouTube, siti educativi, articoli) scritti come testo normale nella sezione Note Docente o Risorse. NON incorporare immagini nel documento.`;

      } else if (activityType === "compito") {
        systemPrompt = `Sei un docente esperto. Genera un COMPITO DA CASA per ${classe?.nome || "la classe"}.
Materia: ${subjectStr}. ${levelContext}

PARAMETRI:
- Tipo consegna: ${tipoConsegna}
- Tempo stimato: ${tempoStimato}

REGOLE:
1. La PRIMA RIGA DEVE essere: TITOLO: [titolo compito]
2. Consegna chiara e comprensibile per gli studenti
3. Esercizi o domande numerati
4. Inserisci ===SOLUZIONI=== dopo il contenuto studente
5. Dopo il separatore: soluzioni commentate, criteri di correzione, note docente
6. Puoi e DEVI includere link a risorse esterne utili (YouTube, siti educativi, articoli) scritti come testo normale nella sezione Note Docente o Risorse. NON incorporare immagini nel documento.`;

      } else if (activityType === "esercizi") {
        systemPrompt = `Sei un docente esperto. Genera una SERIE DI ESERCIZI per ${classe?.nome || "la classe"}.
Materia: ${subjectStr}. ${levelContext}

PARAMETRI:
- Numero esercizi: ${resolvedNumEsercizi}
- Difficoltà: ${difficolta}

REGOLE:
1. La PRIMA RIGA DEVE essere: TITOLO: [titolo esercizi]
2. Esercizi numerati — difficoltà ${difficolta === "Progressiva (dal facile al difficile)" ? "crescente dal primo all'ultimo" : "uniforme"}
3. Ogni esercizio con spazio per la risposta
4. Inserisci ===SOLUZIONI=== dopo il contenuto studente
5. Dopo il separatore: soluzioni dettagliate passo per passo`;

      } else if (activityType === "recupero") {
        systemPrompt = `Sei un docente esperto. Genera un MATERIALE DI RECUPERO per ${classe?.nome || "la classe"}.
Materia: ${subjectStr}. ${levelContext}

MODALITÀ: ${modalitaRecupero}
LIVELLO PARTENZA: ${livelloPartenza}
ARGOMENTO SPECIFICO: ${aiPrompt}

REGOLE:
1. La PRIMA RIGA DEVE essere: TITOLO: Recupero — [argomento]
2. Spiegazione semplice e diretta del concetto base (solo se modalità include spiegazione)
3. Esercizi guidati dal più semplice al più complesso
4. Linguaggio chiaro e diretto — per studenti già in difficoltà
5. Inserisci ===SOLUZIONI=== dopo il contenuto studente
6. Dopo il separatore: soluzioni commentate, suggerimenti per il docente su come usare il materiale in classe`;

      } else if (activityType === "potenziamento") {
        systemPrompt = `Sei un docente esperto. Genera un MATERIALE DI POTENZIAMENTO per ${classe?.nome || "la classe"}.
Materia: ${subjectStr}. ${levelContext}

OBIETTIVO: ${obiettivoPotenziamento}

REGOLE:
1. La PRIMA RIGA DEVE essere: TITOLO: Potenziamento — [argomento]
2. Contenuto che va oltre il programma base — sfidante e stimolante
3. Domande aperte che richiedono ragionamento critico, non solo memoria
4. Inserisci ===SOLUZIONI=== dopo il contenuto studente
5. Dopo il separatore: soluzioni commentate, spunti per discussione in classe, risorse per approfondire`;

      } else {
        systemPrompt = `Sei un docente esperto. Genera materiale didattico di tipo "${activityType}". Classe: ${classe?.nome || ""}. Materia: ${subjectStr}. ${levelContext} ${studentsContext}

REGOLE IMPORTANTI:
1. La PRIMA RIGA del tuo output DEVE essere: TITOLO: [titolo contestuale del materiale]
2. Se il contenuto include soluzioni o note docente, inserisci ===SOLUZIONI=== dopo il contenuto studente.
3. Dopo il separatore: risposte corrette, griglia di valutazione e/o note per il docente.`;
      }

      const maxTokensMap: Record<string, number> = {
        lezione: 6000,
        verifica: 4000,
        recupero: 3500,
        potenziamento: 3500,
        compito: 3000,
        esercizi: 3000,
      };
      const maxTokens = maxTokensMap[activityType] || 3000;

      let userMessage = aiPrompt;
      if (aiContextText) {
        userMessage = `CONTESTO DAL DOCUMENTO CARICATO:\n---\n${aiContextText}\n---\n\nRICHIESTA: ${aiPrompt || "Genera materiale basandoti sul documento caricato."}`;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens,
            systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        }
      );
      const data = await res.json();
      let aiContent = data.choices?.[0]?.message?.content?.trim() || "Errore nella generazione.";

      // Extract title from first line
      const titleMatch = aiContent.match(/^TITOLO:\s*(.+)/i);
      if (titleMatch) {
        setAiTitle(titleMatch[1].trim());
        aiContent = aiContent.replace(/^TITOLO:\s*.+\n*/i, "").trim();
      }

      // Split teacher-only content (works for ALL activity types)
      const { studentContent, teacherContent, wasAutoSplit } = splitTeacherContent(aiContent);
      if (teacherContent) {
        setAiOutput(studentContent);
        setAiSolutions(teacherContent);
        if (wasAutoSplit) {
          toast.warning("Griglia di valutazione rilevata e separata automaticamente. Verifica la suddivisione.");
        }
      } else {
        setAiOutput(aiContent);
      }
      setShowPreview(true);
    } catch {
      toast.error("Errore nella generazione.");
    } finally {
      setAiLoading(false);
    }
  }

  // --- Inline refinement ---
  async function refineAiContent() {
    if (!aiRefinePrompt.trim()) return;
    setAiRefining(true);
    try {
      const fullCurrent = aiSolutions
        ? `${aiOutput}\n\n===SOLUZIONI===\n\n${aiSolutions}`
        : (aiOutput || getPreviewContent());

      const systemPrompt = `You are refining an existing educational document. Apply the requested modification and return the complete updated document with the same structure and formatting. Do not add commentary or explanations — return only the document content.

REGOLE:
1. La PRIMA RIGA del tuo output DEVE essere: TITOLO: [titolo contestuale aggiornato]
2. Se il documento contiene il separatore ===SOLUZIONI===, DEVI mantenerlo nella stessa posizione logica. Tutto ciò che era dopo il separatore deve restare dopo il separatore.
3. Restituisci il documento COMPLETO modificato, non un riassunto.`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens: 6000,
            systemPrompt,
            messages: [{ role: "user", content: `DOCUMENTO ATTUALE:\n---\n${fullCurrent}\n---\n\nMODIFICA RICHIESTA: ${aiRefinePrompt}` }],
          }),
        }
      );
      const data = await res.json();
      let refined = data.choices?.[0]?.message?.content?.trim() || "";
      if (!refined) { toast.error("Errore nel raffinamento."); return; }

      // Extract title
      const titleMatch = refined.match(/^TITOLO:\s*(.+)/i);
      if (titleMatch) {
        setAiTitle(titleMatch[1].trim());
        refined = refined.replace(/^TITOLO:\s*.+\n*/i, "").trim();
      }

      // Split teacher content
      const { studentContent, teacherContent, wasAutoSplit } = splitTeacherContent(refined);
      if (teacherContent) {
        setAiOutput(studentContent);
        setAiSolutions(teacherContent);
        if (wasAutoSplit) toast.warning("Contenuto docente separato automaticamente.");
      } else {
        setAiOutput(refined);
        setAiSolutions(null);
      }

      setShowPreview(true);
      setAiRefinePrompt("");
      toast.success("Contenuto aggiornato!");
    } catch {
      toast.error("Errore nel raffinamento.");
    } finally {
      setAiRefining(false);
    }
  }

  function exportToPdf(title: string, pdfContent: string, type: string) {
    const subjectStr = selectedSubjects.join(", ") || classe?.materia || "";
    renderAndPrintPdf(pdfContent, {
      title,
      type,
      subject: subjectStr,
      className: classe?.nome || "",
    });
  }

  /** Export teacher-only solutions PDF */
  function exportSolutionsPdf(title: string, solutionsContent: string) {
    const subjectStr = selectedSubjects.join(", ") || classe?.materia || "";
    renderAndPrintPdf(solutionsContent, {
      title,
      type: "verifica",
      subject: subjectStr,
      className: classe?.nome || "",
      isTeacherOnly: true,
    });
  }

  /** Export adapted version PDF (BES/DSA/H) */
  function exportAdaptedPdf(title: string, adaptedContent: string, type: string, version: "BES" | "DSA" | "H") {
    const subjectStr = selectedSubjects.join(", ") || classe?.materia || "";
    renderAndPrintPdf(adaptedContent, {
      title,
      type,
      subject: subjectStr,
      className: classe?.nome || "",
      adaptedVersion: version,
    });
  }

  /** Generate adapted versions (BES, DSA, H) via AI and persist to DB */
  const generateAdaptedVersions = useCallback(async (studentContent: string, parentMaterialId?: string) => {
    setAdaptedLoading(true);
    setAdaptedError(false);
    setAdaptedVersions({ bes: null, dsa: null, h: null });

    // If we have a parentMaterialId, check DB first
    if (parentMaterialId) {
      const { data: existing } = await supabase
        .from("teacher_materials")
        .select("target_profile, content")
        .eq("parent_material_id", parentMaterialId)
        .in("target_profile", ["bes", "dsa", "h"]);
      if (existing && existing.length > 0) {
        const loaded: { bes: string | null; dsa: string | null; h: string | null } = { bes: null, dsa: null, h: null };
        existing.forEach((r: any) => {
          if (r.target_profile === "bes") loaded.bes = r.content;
          if (r.target_profile === "dsa") loaded.dsa = r.content;
          if (r.target_profile === "h") loaded.h = r.content;
        });
        if (loaded.bes || loaded.dsa || loaded.h) {
          setAdaptedVersions(loaded);
          setAdaptedLoading(false);
          return;
        }
      }
    }

    try {
      const systemPrompt = `You are an Italian special education specialist. Starting from the attached educational material, generate three separate adapted versions for inclusion in a student's individualized plan. Each version must cover the same topic and learning objectives as the original but adapted as follows:

BES (Bisogni Educativi Speciali): Simplify language and instructions. Use shorter sentences. Break complex tasks into smaller steps. Reduce the total number of exercises if necessary but maintain the same topic coverage.

DSA (Disturbi Specifici dell'Apprendimento): Further simplify written instructions. Use numbered lists instead of paragraphs. Avoid tasks that require copying from a board or long handwriting. Suggest compensatory tools where relevant (e.g. calculator, text-to-speech, concept maps). Use clear visual spacing.

H (Disabilità certificata — obiettivi minimi): Reduce to core essential concepts only. Use very simple language. Maximum 3-4 tasks. Include visual support suggestions. Note that this version must be further adapted by the teacher to match the student's individual PEI.

Return only the three versions with no commentary, separated exactly by ===BES===, ===DSA===, ===H=== on their own lines. Write in Italian.`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens: 6000,
            systemPrompt,
            messages: [{ role: "user", content: `MATERIALE ORIGINALE:\n---\n${studentContent}\n---` }],
          }),
        }
      );
      const data = await res.json();
      const output = data.choices?.[0]?.message?.content?.trim() || "";
      if (!output) throw new Error("Empty response");

      const besMatch = output.split(/===\s*BES\s*===/i);
      const afterBes = besMatch.length > 1 ? besMatch.slice(1).join("===BES===") : "";
      const dsaParts = afterBes.split(/===\s*DSA\s*===/i);
      const besContent = dsaParts[0]?.trim() || null;
      const afterDsa = dsaParts.length > 1 ? dsaParts.slice(1).join("===DSA===") : "";
      const hParts = afterDsa.split(/===\s*H\s*===/i);
      const dsaContent = hParts[0]?.trim() || null;
      const hContent = hParts.length > 1 ? hParts.slice(1).join("===H===").trim() : null;

      if (!besContent && !dsaContent && !hContent) {
        throw new Error("Could not parse adapted versions from AI response");
      }

      setAdaptedVersions({ bes: besContent, dsa: dsaContent, h: hContent });

      // Persist to DB if we have a parent material ID
      if (parentMaterialId) {
        const parentMat = propMaterials.find((m: any) => m.id === parentMaterialId);
        const versions: { key: "bes" | "dsa" | "h"; content: string | null }[] = [
          { key: "bes", content: besContent },
          { key: "dsa", content: dsaContent },
          { key: "h", content: hContent },
        ];
        const inserts = versions
          .filter(v => v.content)
          .map(v => ({
            teacher_id: userId,
            class_id: classId,
            title: `${parentMat?.title || confirmedTitle} — ${v.key.toUpperCase()}`,
            subject: parentMat?.subject || selectedSubjects.join(", ") || classe?.materia || null,
            type: parentMat?.type || activityType,
            content: v.content!,
            target_profile: v.key,
            parent_material_id: parentMaterialId,
            is_sample: parentMat?.is_sample || false,
            status: "draft",
          }));
        if (inserts.length > 0) {
          await supabase.from("teacher_materials").insert(inserts);
        }
      }
    } catch (err) {
      console.error("Adapted versions generation failed:", err);
      setAdaptedError(true);
    } finally {
      setAdaptedLoading(false);
    }
  }, [userId, classId, selectedSubjects, classe, activityType, confirmedTitle, propMaterials]);

  // --- Confirm & assign ---
  async function handleConfirm() {
    const previewContent = getPreviewContent();
    const title = getTitle();

    if (!previewContent.trim()) {
      toast.error("Il contenuto è vuoto");
      return;
    }

    setSaving(true);
    try {
      // Always save as material — include solutions in same record with separator
      const fullContent = aiSolutions
        ? `${previewContent}\n\n===SOLUZIONI===\n\n${aiSolutions}`
        : previewContent;
      const materialPayload = {
        teacher_id: userId,
        class_id: classId,
        title,
        subject: selectedSubjects.join(", ") || classe?.materia || null,
        type: activityType,
        content: fullContent,
        status: destination === "pdf" ? "draft" : "assigned",
        assigned_at: destination !== "pdf" ? new Date().toISOString() : null,
      };
      const { data: insertedMat } = await supabase.from("teacher_materials").insert(materialPayload).select("id").single();
      const parentMaterialId = insertedMat?.id;

      if (destination === "pdf") {
        exportToPdf(title, previewContent, activityType);
        if (aiSolutions) {
          setTimeout(() => exportSolutionsPdf(title, aiSolutions), 600);
        }
        toast.success(aiSolutions ? "PDF studente e soluzioni generati" : "Materiale salvato e PDF generato");
      } else {
        const targetStudents = destination === "all"
          ? students
          : students.filter(s => selectedStudents.includes(s.student_id || s.id));

        if (targetStudents.length === 0) {
          toast.error("Nessuno studente selezionato");
          setSaving(false);
          return;
        }

        const metadata: any = {};
        if (uploadUrl) metadata.attachment_url = uploadUrl;
        if (uploadFile) metadata.attachment_name = uploadFile.name;
        if (mode === "ai") metadata.ai_generated = true;

        const inserts = targetStudents.map(s => ({
          teacher_id: userId,
          class_id: classId,
          student_id: s.student_id || s.id,
          title,
          type: activityType,
          subject: selectedSubjects.join(", ") || classe?.materia || null,
          description: previewContent,
          due_date: dueDate ? dueDate.toISOString() : null,
          metadata,
        }));

        const { error } = await supabase.from("teacher_assignments").insert(inserts);
        if (error) throw error;
        toast.success(`Attività assegnata a ${targetStudents.length} studenti`);
      }

      // Show download panel and trigger adapted versions generation
      setConfirmedContent(previewContent);
      setConfirmedTitle(title);
      setConfirmedSolutions(aiSolutions);
      setShowDownloadPanel(true);
      setShowPreview(false);
      onReload();
      toast.success("Materiale confermato! Scarica le versioni qui sotto.");

      // Generate adapted versions in background and persist to DB
      generateAdaptedVersions(previewContent, parentMaterialId);
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Riprova"));
    }
    setSaving(false);
  }

  // --- Saved materials filter ---
  const filteredMaterials = materialFilter === "tutti"
    ? localMaterials
    : materialFilter === "archiviato"
      ? localMaterials.filter(m => m.status === "archived")
      : localMaterials.filter(m => m.status === materialFilter);

  // --- Download panel (after confirmation) ---
  if (showDownloadPanel) {
    const adaptedButtons: { key: "bes" | "dsa" | "h"; version: "BES" | "DSA" | "H"; emoji: string; color: string; label: string }[] = [
      { key: "bes", version: "BES", emoji: "🟡", color: "text-amber-600", label: "Scarica — Versione BES" },
      { key: "dsa", version: "DSA", emoji: "🔵", color: "text-blue-600", label: "Scarica — Versione DSA" },
      { key: "h", version: "H", emoji: "🟢", color: "text-emerald-600", label: "Scarica — Versione H" },
    ];
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">Materiale confermato</p>
          </div>
          <p className="text-xs text-muted-foreground">{confirmedTitle}</p>

          {/* Download buttons */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scarica versioni</p>

            {/* Standard */}
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl"
              onClick={() => exportToPdf(confirmedTitle, confirmedContent, activityType)}
            >
              <Download className="w-4 h-4 mr-2" />
              📄 Scarica — Versione standard
            </Button>

            {/* BES / DSA / H */}
            {adaptedButtons.map(({ key, version, emoji, label }) => {
              const content = adaptedVersions[key];
              const isLoading = adaptedLoading && !content;
              return (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  disabled={isLoading || (adaptedError && !content)}
                  onClick={() => content && exportAdaptedPdf(confirmedTitle, content, activityType, version)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {emoji} {isLoading ? "Generazione in corso..." : label}
                </Button>
              );
            })}

            {/* Teacher solutions */}
            {confirmedSolutions && (
              <Button
                variant="outline"
                className="w-full justify-start rounded-xl border-emerald-200 dark:border-emerald-800"
                onClick={() => exportSolutionsPdf(confirmedTitle, confirmedSolutions)}
              >
                <Download className="w-4 h-4 mr-2" />
                🔒 Scarica — Soluzioni docente
              </Button>
            )}

            {/* Error + retry */}
            {adaptedError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive flex-1">Errore nella generazione delle versioni adattate.</p>
                <Button size="sm" variant="outline" className="shrink-0 rounded-lg" onClick={() => generateAdaptedVersions(confirmedContent)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Riprova
                </Button>
              </div>
            )}
          </div>

          <Button variant="ghost" className="w-full rounded-xl" onClick={resetForm}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Torna ai materiali
          </Button>
        </div>
      </div>
    );
  }

  // --- Card selector ---
  if (mode === null) {
    return (
      <div className="space-y-8">
        {/* Selection cards */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-5 flex items-center gap-2">
            <Send className="w-3.5 h-3.5" /> Crea e assegna
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {([
              {
                key: "write" as const,
                icon: PenLine,
                title: "Scrivo io",
                desc: "Sai già cosa assegnare e vuoi scriverlo direttamente.",
              },
              {
                key: "ai" as const,
                icon: Sparkles,
                title: coachGeneratorLabel,
                desc: "Non hai il materiale — descrivi cosa vuoi e il sistema lo costruisce per te. Puoi anche caricare un tuo materiale come modello.",
              },
              {
                key: "file" as const,
                icon: Upload,
                title: "Carico e assegno",
                desc: "Hai già un file pronto — una foto del libro, un PDF, un documento. Il sistema lo legge e lo assegna.",
              },
            ]).map(({ key, icon: Icon, title, desc }) => (
              <motion.button
                key={key}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(key)}
                className="flex flex-col items-start text-left p-7 bg-card border border-border/60 rounded-[24px] hover:border-primary/40 hover:shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all group min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <p className="font-bold text-foreground text-[20px] tracking-tight mb-2 leading-tight">{title}</p>
                <p className="text-[14px] text-muted-foreground leading-relaxed">{desc}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Saved materials */}
        {!hideSaved && (localMaterials.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <BookOpen className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nessun materiale salvato. Ogni materiale creato verrà salvato automaticamente qui.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Materiali salvati ({localMaterials.length})
              </p>
              <div className="flex gap-1">
                {["tutti", "assigned", "draft", "archiviato"].map(f => (
                  <button key={f} onClick={() => setMaterialFilter(f)}
                    className={cn("text-xs px-2.5 py-1 rounded-full transition-colors",
                      materialFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}>
                    {f === "tutti" ? "Tutti" : f === "draft" ? "Non assegnati" : f === "assigned" ? "Assegnati" : "Archiviati"}
                  </button>
                ))}
              </div>
            </div>
            <SharedMaterialsList
              materials={filteredMaterials}
              setMaterials={setLocalMaterials}
              adaptedMap={adaptedMap}
              setAdaptedMap={setAdaptedMap}
              classMap={classMap}
              classi={classiList}
              userId={userId}
              onReload={onReload}
            />
          </div>
        ))}
      </div>
    );
  }

  // --- Preview view ---

  if (showPreview) {
    const previewContent = getPreviewContent();
    const title = getTitle();
    const typeBadgeLabel = activityType.charAt(0).toUpperCase() + activityType.slice(1);

    const openContentModal = (type: "student" | "teacher") => {
      setPreviewModalType(type);
      setPreviewEditMode(false);
      setPreviewAiEditMode(false);
      setPreviewAiPrompt("");
      setPreviewEditText(type === "student" ? previewContent : (aiSolutions || ""));
      setPreviewModalOpen(true);
    };

    const handleEditSave = () => {
      if (previewModalType === "student") {
        if (mode === "ai") setAiOutput(previewEditText);
        else setContent(previewEditText);
      } else {
        setAiSolutions(previewEditText || null);
      }
      setPreviewEditMode(false);
      toast.success("Contenuto aggiornato");
    };

    // AI refinement scoped to the current modal section
    const handleModalAiRefine = async () => {
      if (!previewAiPrompt.trim()) return;
      setPreviewAiRefining(true);
      try {
        const currentContent = previewModalType === "student" ? previewContent : (aiSolutions || "");
        const sectionLabel = previewModalType === "student" ? "contenuto per gli studenti" : "soluzioni per il docente";

        const systemPrompt = `Stai modificando SOLO la sezione "${sectionLabel}" di un documento didattico. Applica la modifica richiesta e restituisci SOLO questa sezione aggiornata, senza aggiungere commenti o spiegazioni. Mantieni la stessa struttura e formattazione.`;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              stream: false,
              maxTokens: 4000,
              systemPrompt,
              messages: [{ role: "user", content: `CONTENUTO ATTUALE:\n---\n${currentContent}\n---\n\nMODIFICA RICHIESTA: ${previewAiPrompt}` }],
            }),
          }
        );
        const data = await res.json();
        const refined = data.choices?.[0]?.message?.content?.trim();
        if (!refined) { toast.error("Errore nella modifica AI."); return; }

        if (previewModalType === "student") {
          if (mode === "ai") setAiOutput(refined);
          else setContent(refined);
        } else {
          setAiSolutions(refined);
        }

        setPreviewAiPrompt("");
        setPreviewAiEditMode(false);
        toast.success("Contenuto aggiornato con AI!");
      } catch {
        toast.error("Errore nella modifica AI.");
      } finally {
        setPreviewAiRefining(false);
      }
    };

    const modalContent = previewModalType === "student" ? previewContent : (aiSolutions || "");
    const modalTitle = previewModalType === "student" ? "Contenuto per gli alunni" : "Soluzioni per il docente";
    const modalIcon = previewModalType === "student"
      ? <FileText className="w-5 h-5" />
      : <Lock className="w-5 h-5" />;

    const previewModalBody = (
      <div className="flex h-full flex-col bg-background">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 pr-8">
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl",
                previewModalType === "student" ? "bg-primary/10 text-primary" : "bg-sage-light text-sage"
              )}
            >
              {modalIcon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{modalTitle}</p>
              <p className="truncate text-xs text-muted-foreground">{title}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {previewEditMode ? (
            <Textarea
              value={previewEditText}
              onChange={e => setPreviewEditText(e.target.value)}
              className="min-h-[400px] rounded-xl font-mono text-xs"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground">
              {formatMaterialContent(modalContent)}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 py-4">
          {previewEditMode ? (
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={handleEditSave}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Salva modifiche
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setPreviewEditMode(false)}>
                Annulla
              </Button>
            </div>
          ) : previewAiEditMode ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={previewAiPrompt}
                  onChange={e => setPreviewAiPrompt(e.target.value)}
                  placeholder="Es: 'Aggiungi un esempio', 'Semplifica il linguaggio', 'Riduci a 5 domande'"
                  className="rounded-xl text-sm"
                  disabled={previewAiRefining}
                  onKeyDown={e => { if (e.key === "Enter" && previewAiPrompt.trim()) handleModalAiRefine(); }}
                  autoFocus
                />
                <Button
                  size="sm"
                  className="shrink-0 rounded-xl"
                  onClick={handleModalAiRefine}
                  disabled={!previewAiPrompt.trim() || previewAiRefining}
                >
                  {previewAiRefining ? <><RotateCcw className="mr-1 h-3.5 w-3.5 animate-spin" /> Aggiorno...</> : <><Sparkles className="mr-1 h-3.5 w-3.5" /> Applica</>}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => { setPreviewAiEditMode(false); setPreviewAiPrompt(""); }}>
                ← Torna all'anteprima
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setPreviewEditText(modalContent);
                    setPreviewEditMode(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Modifica manuale
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => setPreviewAiEditMode(true)}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Modifica con AI
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    if (previewModalType === "student") exportToPdf(title, previewContent, activityType);
                    else if (aiSolutions) exportSolutionsPdf(title, aiSolutions);
                    toast.success("PDF generato");
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {previewModalType === "student" ? "Scarica PDF" : "Scarica soluzioni"}
                </Button>
              </div>
              <Button
                className="h-11 w-full rounded-xl"
                onClick={() => {
                  setPreviewModalOpen(false);
                  handleConfirm();
                }}
                disabled={saving || aiRefining || previewAiRefining}
              >
                <Send className="mr-1 h-3.5 w-3.5" />
                {saving ? "Salvataggio..." : "Conferma e salva"}
              </Button>
            </>
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="rounded-xl">
          <ArrowLeft className="mr-1 h-4 w-4" /> Modifica
        </Button>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Anteprima</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeBadgeLabel}</Badge>
            {selectedSubjects.length > 0 && <Badge variant="outline" className="text-xs">{selectedSubjects.join(", ")}</Badge>}
            {dueDate && <span className="text-xs text-muted-foreground">{format(dueDate, "dd MMM yyyy", { locale: it })}</span>}
          </div>

          <div className="text-xs text-muted-foreground">
            {destination === "all" ? `Tutta la classe (${students.length} studenti)` :
              destination === "selected" ? `${selectedStudents.length} studenti selezionati` :
                "Solo scarica PDF (non assegnato digitalmente)"}
          </div>

          <div className="space-y-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openContentModal("student")}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Contenuto per gli alunni</p>
                    <Badge variant="secondary">{typeBadgeLabel}</Badge>
                  </div>
                  <p className="truncate text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">Tocca per visualizzare</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </motion.button>

            {aiSolutions && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openContentModal("teacher")}
                className="w-full rounded-2xl border border-sage/20 bg-sage-light/60 p-4 text-left shadow-sm transition-all hover:border-sage/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-sage">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Soluzioni per il docente</p>
                      <Badge variant="outline" className="border-sage/30 text-sage-dark">Docente</Badge>
                    </div>
                    <p className="truncate text-sm text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">Tocca per visualizzare</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </motion.button>
            )}
          </div>

        </div>

        {isMobile ? (
          <Sheet open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
            <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] overflow-hidden rounded-none p-0">
              {previewModalBody}
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
            <DialogContent className="flex h-[85vh] max-w-4xl flex-col overflow-hidden p-0">
              {previewModalBody}
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // --- Form view ---
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => { resetForm(); }} className="rounded-xl text-[14px] font-medium h-10">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Torna alla scelta
      </Button>

      <div className="bg-card border border-border rounded-[24px] p-6 sm:p-8 space-y-7">
        <p className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground flex items-center gap-2.5">
          {mode === "write" && <><PenLine className="w-4 h-4 text-primary" /> Scrivo io</>}
          {mode === "ai" && <><Sparkles className="w-4 h-4 text-primary" /> {coachGeneratorLabel}</>}
          {mode === "file" && <><Upload className="w-4 h-4 text-primary" /> Carico e assegno</>}
        </p>

        {/* Activity type */}
        <div>
          <Label className="text-[14px] font-semibold text-foreground/80">Tipo attività</Label>
          <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
            <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject multi-select */}
        <div>
          <Label className="text-[14px] font-semibold text-foreground/80">Materia</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5 mb-2">
            {selectedSubjects.map(s => (
              <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[13px] font-medium">
                {s}
                <button onClick={() => {
                  setDidCustomizeSubjects(true);
                  setSelectedSubjects(prev => prev.filter(x => x !== s));
                }} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
          <Select
            value=""
            onValueChange={(v) => {
              if (v && !selectedSubjects.includes(v)) {
                setDidCustomizeSubjects(true);
                setSelectedSubjects(prev => [...prev, v]);
              }
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={selectedSubjects.length === 0 ? "Seleziona materia" : "Aggiungi materia..."} />
            </SelectTrigger>
            <SelectContent>
              {MATERIE_OPTIONS.filter(m => !selectedSubjects.includes(m)).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSubjects.length === 0 && (
            <p className="text-[13px] text-destructive mt-2">Seleziona almeno una materia</p>
          )}
        </div>

        {/* --- FORM B prompt: Descrivi cosa vuoi (right after Materia for AI mode) --- */}
        {mode === "ai" && (
          <div className="space-y-4">
            <div>
              <Label className="text-[14px] font-semibold text-foreground/80">Descrivi cosa vuoi</Label>
              <Textarea
                placeholder={getPlaceholderB(activityType, selectedSubjects, classe?.nome || "")}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="mt-1 rounded-xl min-h-[100px]"
              />
            </div>

            {/* === Dynamic type-specific fields === */}
            <AnimatePresence mode="wait">
              {activityType === "lezione" && (
                <motion.div
                  key="lezione-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri lezione</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Durata</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["50 min", "60 min", "90 min", "Personalizzato"].map(v => (
                        <button key={v} onClick={() => setDurataLezione(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            durataLezione === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                    {durataLezione === "Personalizzato" && (
                      <Input type="text" value={durataLezioneCustom} onChange={e => setDurataLezioneCustom(e.target.value)}
                        placeholder="Es. 75 min" className="mt-1.5 rounded-lg w-32 h-8 text-xs" />
                    )}
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Obiettivo principale</Label>
                    <Input type="text" value={obiettivoLezione} onChange={e => setObiettivoLezione(e.target.value)}
                      placeholder="Cosa devono saper fare alla fine della lezione" className="mt-1.5 rounded-lg h-9 text-xs" />
                  </div>
                </motion.div>
              )}

              {activityType === "verifica" && (
                <motion.div
                  key="verifica-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri verifica</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Numero domande</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["5", "10", "15", "Personalizzato"].map(v => (
                        <button key={v} onClick={() => setNumDomande(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            numDomande === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                    {numDomande === "Personalizzato" && (
                      <Input type="number" min={1} max={50} value={numDomandeCustom} onChange={e => setNumDomandeCustom(e.target.value)}
                        placeholder="Numero" className="mt-1.5 rounded-lg w-24 h-8 text-xs" />
                    )}
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Struttura</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Solo aperte", "Solo chiuse (scelta multipla/V-F)", "Mista aperte+chiuse", "Solo esercizi pratici"].map(v => (
                        <button key={v} onClick={() => setStruttura(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            struttura === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Punteggio totale</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["10", "15", "20", "30", "Personalizzato"].map(v => (
                        <button key={v} onClick={() => setPunteggioTotale(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            punteggioTotale === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                    {punteggioTotale === "Personalizzato" && (
                      <Input type="number" min={1} max={100} value={punteggioCustom} onChange={e => setPunteggioCustom(e.target.value)}
                        placeholder="Punti" className="mt-1.5 rounded-lg w-24 h-8 text-xs" />
                    )}
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Tempo disponibile</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["30 min", "45 min", "60 min", "90 min"].map(v => (
                        <button key={v} onClick={() => setTempoDisponibile(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            tempoDisponibile === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activityType === "compito" && (
                <motion.div
                  key="compito-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri compito</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Tipo consegna</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Esercizi pratici", "Domande aperte", "Riassunto/tema", "Ricerca", "Misto"].map(v => (
                        <button key={v} onClick={() => setTipoConsegna(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            tipoConsegna === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Tempo stimato</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["15 min", "30 min", "45 min", "60 min"].map(v => (
                        <button key={v} onClick={() => setTempoStimato(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            tempoStimato === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activityType === "esercizi" && (
                <motion.div
                  key="esercizi-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri esercizi</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Numero esercizi</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["5", "10", "15", "Personalizzato"].map(v => (
                        <button key={v} onClick={() => setNumEsercizi(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            numEsercizi === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                    {numEsercizi === "Personalizzato" && (
                      <Input type="number" min={1} max={50} value={numEserciziCustom} onChange={e => setNumEserciziCustom(e.target.value)}
                        placeholder="Numero" className="mt-1.5 rounded-lg w-24 h-8 text-xs" />
                    )}
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Difficoltà</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Base", "Normale", "Avanzato", "Progressiva (dal facile al difficile)"].map(v => (
                        <button key={v} onClick={() => setDifficolta(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            difficolta === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Includi soluzioni per il docente</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Sì", "No"].map(v => (
                        <button key={v} onClick={() => setIncludiSoluzioni(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            includiSoluzioni === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activityType === "recupero" && (
                <motion.div
                  key="recupero-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri recupero</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Modalità</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Spiegazione + esercizi", "Solo esercizi", "Solo spiegazione"].map(v => (
                        <button key={v} onClick={() => setModalitaRecupero(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            modalitaRecupero === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Livello partenza</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Dalle basi", "Argomento specifico"].map(v => (
                        <button key={v} onClick={() => setLivelloPartenza(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            livelloPartenza === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activityType === "potenziamento" && (
                <motion.div
                  key="potenziamento-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1">Parametri potenziamento</p>
                  <div>
                    <Label className="text-[14px] font-semibold text-foreground/80">Obiettivo</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Approfondimento teorico", "Problemi complessi", "Collegamento con altri argomenti", "Ricerca autonoma"].map(v => (
                        <button key={v} onClick={() => setObiettivoPotenziamento(v)}
                          className={cn("px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                            obiettivoPotenziamento === v ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/20"
                          )}>{v}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <Label className="text-[14px] font-semibold text-foreground/80 mb-1.5 block">Carica modello (opzionale)</Label>
              <input
                ref={aiFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAiContextUpload(file);
                }}
              />
              {!aiContextFile ? (
                <button
                  onClick={() => aiFileRef.current?.click()}
                  disabled={aiContextUploading}
                  className="w-full border border-dashed border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[14px] text-muted-foreground">
                    {aiContextUploading ? "Analisi in corso..." : "Carica un file come riferimento di formato e livello"}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{aiContextFile.name}</p>
                    {aiContextText && <p className="text-[10px] text-muted-foreground truncate">{aiContextText.slice(0, 80)}...</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0 h-7 w-7 p-0" onClick={() => {
                    setAiContextFile(null);
                    setAiContextText(null);
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {aiContextFile && (
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                  Il sistema userà questo materiale come modello. Descrivi l'argomento e la classe e l'AI creerà qualcosa di simile nello stesso formato e allo stesso livello.
                </p>
              )}
            </div>
          </div>
        )}

        {/* --- Destination --- */}
        <div>
          <Label className="text-[14px] font-semibold text-foreground/80 mb-2 block">Destinazione</Label>
          <RadioGroup value={destination} onValueChange={(v) => setDestination(v as DestinationType)} className="flex gap-2 flex-wrap">
            {([
              { value: "all", label: "Tutta la classe" },
              { value: "selected", label: "Studenti specifici" },
              { value: "pdf", label: "Scarica PDF" },
            ] as const).map(({ value, label }) => (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-[14px] font-medium",
                  destination === value
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/20"
                )}
              >
                <RadioGroupItem value={value} className="sr-only" />
                {label}
              </label>
            ))}
          </RadioGroup>
          {destination === "selected" && (
            <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1 mt-2">
              {students.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nessuno studente iscritto</p>
              ) : students.map(s => {
                const sid = s.student_id || s.id;
                const checked = selectedStudents.includes(sid);
                return (
                  <label key={sid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      setSelectedStudents(prev => v ? [...prev, sid] : prev.filter(x => x !== sid));
                    }} />
                    <span className="text-sm">{s.profile?.name || s.name || "Studente"}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Due date */}
        <div>
          <Label className="text-[14px] font-semibold text-foreground/80">Scadenza (opzionale)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full mt-1 rounded-xl justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={setDueDate}
                disabled={(date) => date < new Date()}
                initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* --- FORM A: Scrivo io --- */}
        {mode === "write" && (
          <div>
            <Label className="text-[14px] font-semibold text-foreground/80">Contenuto</Label>
            <Textarea
              placeholder={getPlaceholderA(activityType, selectedSubjects)}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="mt-1 rounded-xl min-h-[120px]"
            />
          </div>
        )}

        {/* --- FORM B: Genera button (AI mode, always last) --- */}
        {mode === "ai" && (
          <div className="space-y-4">
            <Button onClick={generateAiContent} disabled={aiLoading} variant="outline" className="w-full rounded-xl h-12 text-[15px] font-semibold">
              <Sparkles className="w-4 h-4 mr-1.5" />
              {aiLoading ? "Generazione in corso..." : "Genera contenuto"}
            </Button>

            {aiOutput && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Anteprima pronta. Usa "Anteprima e conferma" per rivedere il contenuto formattato.
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- FORM C: Carico e assegno --- */}
        {mode === "file" && (
          <div className="space-y-4">
            <div>
              <Label className="text-[14px] font-semibold text-foreground/80 mb-1.5 block">Carica file</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {!uploadFile ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    {uploading ? "Caricamento..." : "Carica PDF, immagine o documento"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puoi caricare la foto di una pagina del libro, un PDF con esercizi o qualsiasi documento già pronto. Il sistema estrae il testo automaticamente.
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-xl">
                  <FileText className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => {
                    setUploadFile(null);
                    setUploadUrl(null);
                    setOcrText(null);
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {ocrLoading && (
              <p className="text-xs text-muted-foreground text-center animate-pulse">Estrazione testo in corso...</p>
            )}

            {ocrText && (
              <div>
                <Label className="text-[14px] font-semibold text-foreground/80">Anteprima contenuto estratto (modificabile)</Label>
                <Textarea
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  className="mt-1 rounded-xl min-h-[120px] text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <Button
          className="w-full rounded-xl h-12 text-[15px] font-semibold"
          onClick={() => {
            const pc = getPreviewContent();
            if (!pc.trim()) {
              toast.error("Inserisci o genera il contenuto prima di procedere");
              return;
            }
            setShowPreview(true);
          }}
          disabled={
            (mode === "write" && !content.trim()) ||
            (mode === "ai" && !aiOutput) ||
            (mode === "file" && !ocrText)
          }
        >
          <Eye className="w-4 h-4 mr-1.5" />
          Anteprima e conferma
        </Button>
      </div>
    </div>
  );
}