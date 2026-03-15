import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const schoolLevels = [
  { id: "primaria-1-2", label: "Primaria 1ª-2ª" },
  { id: "primaria-3-5", label: "Primaria 3ª-5ª" },
  { id: "media-1", label: "Media 1ª" },
  { id: "media-2", label: "Media 2ª" },
  { id: "media-3", label: "Media 3ª" },
];

const subjects = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia",
  "Inglese", "Arte", "Musica", "Tecnologia",
];

const struggles = [
  { id: "distraction", label: "Si distrae facilmente", emoji: "🦋" },
  { id: "refusal", label: "Rifiuta di iniziare", emoji: "🛑" },
  { id: "anxiety", label: "Ansia da prestazione", emoji: "😰" },
  { id: "slowness", label: "È molto lento", emoji: "🐢" },
  { id: "low-confidence", label: "Poca fiducia in sé", emoji: "🌧️" },
  { id: "poor-memory", label: "Fatica a ricordare", emoji: "🧠" },
];

const supportStyles = [
  { id: "gentle", label: "Gentile e paziente", emoji: "🌿" },
  { id: "playful", label: "Giocoso e leggero", emoji: "🎈" },
  { id: "challenge", label: "Stimolante e sfidante", emoji: "🚀" },
  { id: "calm", label: "Calmo e rassicurante", emoji: "☁️" },
];

interface OnboardingData {
  name: string;
  age: string;
  schoolLevel: string;
  favoriteSubjects: string[];
  difficultSubjects: string[];
  struggles: string[];
  focusTime: string;
  supportStyle: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    age: "",
    schoolLevel: "",
    favoriteSubjects: [],
    difficultSubjects: [],
    struggles: [],
    focusTime: "15",
    supportStyle: "",
  });

  const totalSteps = 6;

  const toggleInArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const canProceed = () => {
    switch (step) {
      case 0: return data.name.trim() !== "" && data.age !== "";
      case 1: return data.schoolLevel !== "";
      case 2: return data.favoriteSubjects.length > 0;
      case 3: return data.struggles.length > 0;
      case 4: return data.supportStyle !== "";
      case 5: return true;
      default: return false;
    }
  };

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else {
      localStorage.setItem("inschool-profile", JSON.stringify(data));
      navigate("/dashboard");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Ciao! Come ti chiami?</h2>
              <p className="text-muted-foreground">Così il tuo coach saprà come chiamarti.</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Il tuo nome"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg"
              />
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Quanti anni hai?</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }, (_, i) => (i + 6).toString()).map((age) => (
                    <button
                      key={age}
                      onClick={() => setData({ ...data, age })}
                      className={`w-12 h-12 rounded-xl font-display font-semibold text-lg transition-all ${
                        data.age === age
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Che classe fai, {data.name}?</h2>
              <p className="text-muted-foreground">Adatteremo tutto al tuo livello.</p>
            </div>
            <div className="space-y-3">
              {schoolLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setData({ ...data, schoolLevel: level.id })}
                  className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                    data.schoolLevel === level.id
                      ? "border-primary bg-sage-light text-foreground shadow-soft"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{level.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Quali materie ti piacciono?</h2>
              <p className="text-muted-foreground">Seleziona quelle che preferisci. Poi scegli quelle più difficili.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Ti piacciono 💚</label>
              <div className="flex flex-wrap gap-2 mb-6">
                {subjects.map((subj) => (
                  <button
                    key={`fav-${subj}`}
                    onClick={() => setData({ ...data, favoriteSubjects: toggleInArray(data.favoriteSubjects, subj) })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      data.favoriteSubjects.includes(subj)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
              <label className="text-sm font-medium text-foreground mb-3 block">Sono difficili 🤔</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subj) => (
                  <button
                    key={`diff-${subj}`}
                    onClick={() => setData({ ...data, difficultSubjects: toggleInArray(data.difficultSubjects, subj) })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      data.difficultSubjects.includes(subj)
                        ? "bg-terracotta text-destructive-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Cosa succede quando studi?</h2>
              <p className="text-muted-foreground">Scegli tutto quello che ti succede. Non c'è niente di sbagliato.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {struggles.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setData({ ...data, struggles: toggleInArray(data.struggles, s.id) })}
                  className={`text-left px-4 py-4 rounded-2xl border transition-all ${
                    data.struggles.includes(s.id)
                      ? "border-primary bg-sage-light shadow-soft"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-xl mr-2">{s.emoji}</span>
                  <span className="font-medium text-foreground text-sm">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Come vuoi che ti aiuti il coach?</h2>
              <p className="text-muted-foreground">Scegli lo stile che ti fa sentire più a tuo agio.</p>
            </div>
            <div className="space-y-3">
              {supportStyles.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setData({ ...data, supportStyle: s.id })}
                  className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                    data.supportStyle === s.id
                      ? "border-primary bg-sage-light shadow-soft"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-xl mr-3">{s.emoji}</span>
                  <span className="font-medium text-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Quanto riesci a concentrarti?</h2>
              <p className="text-muted-foreground">Va benissimo anche poco. Cresceremo insieme.</p>
            </div>
            <div className="space-y-3">
              {[
                { val: "10", label: "10 minuti", desc: "Perfetto per iniziare" },
                { val: "15", label: "15 minuti", desc: "Un buon equilibrio" },
                { val: "20", label: "20 minuti", desc: "Già molto bravo" },
                { val: "25", label: "25 minuti", desc: "Un vero campione di focus" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setData({ ...data, focusTime: opt.val })}
                  className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                    data.focusTime === opt.val
                      ? "border-primary bg-sage-light shadow-soft"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{opt.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">— {opt.desc}</span>
                    </div>
                    {data.focusTime === opt.val && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold text-foreground">Inschool</span>
          </div>
          <span className="text-sm text-muted-foreground">{step + 1} di {totalSteps}</span>
        </div>
        {/* Progress bar */}
        <div className="max-w-lg mx-auto mt-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              transition={spring}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pt-8 pb-32">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={spring}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => step > 0 ? setStep(step - 1) : navigate("/")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Indietro
          </Button>
          <Button
            onClick={next}
            disabled={!canProceed()}
            className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-6 disabled:opacity-40"
          >
            {step === totalSteps - 1 ? "Iniziamo!" : "Avanti"}
            <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
