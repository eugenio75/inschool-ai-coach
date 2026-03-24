import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, FileText, Map, List, Key, Layers } from "lucide-react";
import { ChatShell } from "@/components/ChatShell";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getPrepLabel(schoolLevel: string) {
  switch (schoolLevel) {
    case "alunno": case "medie": return "Prepara l'interrogazione";
    case "universitario": return "Prepara l'esame";
    default: return "Prepara la verifica";
  }
}

const OUTPUT_TYPES = [
  { id: "schema", label: "Schema", icon: List },
  { id: "mappa", label: "Mappa concettuale", icon: Map },
  { id: "sintesi_breve", label: "Sintesi breve", icon: FileText },
  { id: "sintesi_estesa", label: "Sintesi estesa", icon: BookOpen },
  { id: "glossario", label: "Glossario", icon: Key },
  { id: "punti_chiave", label: "Punti chiave", icon: Layers },
];

type SessionType = "study" | "review" | "prep";

export default function UnifiedSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") || "study") as SessionType;
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const { user } = useAuth();

  // Setup state
  const [setupDone, setSetupDone] = useState(false);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);

  const subjects = profile?.favorite_subjects || profile?.difficult_subjects || ["Matematica", "Italiano", "Inglese", "Storia", "Scienze"];
  const studentName = profile?.name || "Studente";
  const profileId = profile?.id || getChildSession()?.profileId;

  // Build the initial system prompt based on session type
  function getSystemPrompt(): string {
    switch (type) {
      case "study":
        return `Sei un coach di studio per ${studentName} (livello ${schoolLevel}).
L'argomento è: "${topic}" (${subject || "materia non specificata"}).
Dividi l'argomento in blocchi logici. Per ogni blocco:
1. Presenta brevemente il concetto
2. Fai una domanda di comprensione
3. Attendi la risposta prima di proseguire
4. Costruisci connessioni tra i blocchi
Non dare mai la risposta finale direttamente. Guida lo studente a ragionare.
Inizia presentando il primo blocco dell'argomento.`;
      case "review":
        return `Sei il Coach AI di ${studentName}. Stai facendo un RIPASSO PROFONDO.
MATERIA: ${subject || "generale"}
ARGOMENTO: ${topic}
LIVELLO: ${schoolLevel}

REGOLE:
- Fai domande aperte e profonde — mai rilettura passiva
- Richiamo attivo: lo studente deve ricordare, non rileggere
- Una domanda alla volta
- Dopo la risposta: conferma cosa è giusto, correggi cosa no
- Dopo 3-4 scambi: riassumi i punti forti e deboli emersi
- Sii socratico e incoraggiante
Inizia con la prima domanda sull'argomento.`;
      case "prep":
        return `Sei il Coach AI di ${studentName}. Stai conducendo una SIMULAZIONE DI ${mode === "orale" ? "INTERROGAZIONE ORALE" : "VERIFICA SCRITTA"}.
MATERIA: ${subject}
LIVELLO: ${schoolLevel}

REGOLE:
- Fai domande calibrate sulla materia — NON domande generiche
- ${mode === "orale" ? "Simula un'interrogazione: una domanda alla volta, attendi risposta, fai follow-up" : "Fai domande di diverso tipo: definizioni, problemi, ragionamento"}
- Adatta la difficoltà: se risponde bene alza, se sbaglia abbassa
- Dopo 5-6 domande, fornisci un REPORT finale strutturato con:
  [REPORT]
  Punti forti: ...
  Punti deboli: ...
  Priorità di ripasso: ...
  [/REPORT]
- Non dare mai la risposta — guida con indizi se bloccato
Inizia con la prima domanda.`;
      default:
        return "";
    }
  }

  function getTitle(): string {
    switch (type) {
      case "study": return "Studio libero";
      case "review": return "Ripasso profondo";
      case "prep": return getPrepLabel(schoolLevel);
      default: return "Sessione";
    }
  }

  function startSession() {
    if (!topic.trim() && type !== "prep") return;
    if (!subject && type === "prep") return;

    const systemPrompt = getSystemPrompt();
    setSetupDone(true);
    setMessages([]);
    setSending(true);
    setStreamingText("");

    // Send the initial prompt to get the first coach message
    streamChat({
      messages: [{ role: "user", content: systemPrompt }],
      onDelta: (full) => setStreamingText(full),
      onDone: (full) => {
        setMessages([{ role: "assistant", content: full }]);
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined },
    }).catch(() => {
      setMessages([{ role: "assistant", content: "Mi dispiace, c'è stato un problema. Riprova." }]);
      setStreamingText("");
      setSending(false);
    });
  }

  const handleSend = useCallback((text: string) => {
    if (sending) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);
    setStreamingText("");

    streamChat({
      messages: newMessages,
      onDelta: (full) => setStreamingText(full),
      onDone: (full) => {
        setMessages(prev => [...prev, { role: "assistant", content: full }]);
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined },
    }).catch(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore. Riprova." }]);
      setStreamingText("");
      setSending(false);
    });
  }, [messages, sending, profileId, subject]);

  // Output generation for study sessions
  async function generateOutput(outputType: string) {
    const outputPrompts: Record<string, string> = {
      schema: `Genera uno schema strutturato dell'argomento "${topic}" basandoti sulla conversazione. Usa punti e sottopunti.`,
      mappa: `Genera una mappa concettuale testuale dell'argomento "${topic}". Mostra le connessioni tra i concetti principali.`,
      sintesi_breve: `Genera una sintesi breve (max 200 parole) dell'argomento "${topic}" basandoti sulla conversazione.`,
      sintesi_estesa: `Genera una sintesi estesa e dettagliata dell'argomento "${topic}" basandoti sulla conversazione.`,
      glossario: `Genera un glossario con i termini chiave dell'argomento "${topic}" emersi dalla conversazione, con definizioni concise.`,
      punti_chiave: `Elenca i 5-10 punti chiave dell'argomento "${topic}" emersi dalla conversazione. Ogni punto in una frase.`,
    };
    handleSend(outputPrompts[outputType] || outputPrompts.schema);
  }

  // Setup screen
  if (!setupDone) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}><BookOpen className="w-5 h-5 text-muted-foreground" /></button>
          <h1 className="font-display text-lg font-bold text-foreground">{getTitle()}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Topic input (not needed for prep if subject-only) */}
          {type !== "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                {type === "review" ? "Cosa vuoi ripassare?" : "Cosa vuoi studiare?"}
              </label>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="es. La Rivoluzione Francese, Le equazioni di secondo grado..."
                className="text-sm"
                onKeyDown={e => e.key === "Enter" && startSession()}
              />
            </div>
          )}

          {/* Subject picker */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {type === "prep" ? "Materia" : "Materia (opzionale)"}
            </label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s: string) => (
                <button
                  key={s}
                  onClick={() => setSubject(subject === s ? "" : s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    subject === s
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Prep: mode selector */}
          {type === "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tipo di simulazione</label>
              <div className="flex gap-3">
                {([["scritta", "Verifica scritta"], ["orale", "Interrogazione orale"]] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prep: topic (optional) */}
          {type === "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Argomento specifico (opzionale)</label>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="es. Capitolo 5, Termodinamica..."
                className="text-sm"
              />
            </div>
          )}

          <Button
            onClick={startSession}
            disabled={type === "prep" ? !subject : !topic.trim()}
            className="w-full"
          >
            {type === "prep" ? "Inizia la simulazione" : type === "review" ? "Inizia il ripasso" : "Inizia a studiare"}
          </Button>
        </div>
      </div>
    );
  }

  // Study output footer
  const studyOutputFooter = type === "study" && messages.length >= 4 ? (
    <div className="px-4 py-2 border-t border-border bg-muted/50">
      <p className="text-xs text-muted-foreground mb-2">Genera un output dalla sessione:</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {OUTPUT_TYPES.map(ot => (
          <button
            key={ot.id}
            onClick={() => generateOutput(ot.id)}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-foreground/40 whitespace-nowrap transition-colors"
          >
            <ot.icon className="w-3 h-3" />
            {ot.label}
          </button>
        ))}
      </div>
    </div>
  ) : undefined;

  return (
    <ChatShell
      title={topic || subject || getTitle()}
      subtitle={subject && topic ? subject : undefined}
      badgeText={type === "prep" ? (mode === "orale" ? "Orale" : "Scritta") : undefined}
      messages={messages}
      streamingText={streamingText}
      sending={sending}
      onSend={handleSend}
      onBack={() => navigate(-1)}
      showHint={type !== "prep"}
      showStuck={type !== "prep"}
      showExplain={true}
      showVoice={type === "prep" ? mode === "orale" || schoolLevel === "superiori" || schoolLevel === "universitario" : true}
      showAttach={type === "study"}
      extraFooter={studyOutputFooter}
      inputPlaceholder={type === "prep" ? "Scrivi la tua risposta..." : "Scrivi..."}
    />
  );
}
