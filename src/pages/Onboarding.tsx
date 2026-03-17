import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createChildProfile, setActiveChildProfileId } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const avatarOptions = ["🧒", "👦", "👧", "🧒🏻", "👦🏽", "👧🏾", "🦸", "🧙", "🦊", "🐱", "🐻", "🌟"];

const schoolLevels = [
  { id: "primaria-1-2", label: "Primaria 1ª-2ª" },
  { id: "primaria-3-5", label: "Primaria 3ª-5ª" },
  { id: "media-1", label: "Media 1ª" },
  { id: "media-2", label: "Media 2ª" },
  { id: "media-3", label: "Media 3ª" },
];

const subjects = ["Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte", "Musica", "Tecnologia"];

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
  avatar: string;
  age: string;
  gender: string;
  schoolLevel: string;
  favoriteSubjects: string[];
  difficultSubjects: string[];
  struggles: string[];
  focusTime: string;
  supportStyles: string[];
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: "", avatar: "🧒", age: "", gender: "", schoolLevel: "", favoriteSubjects: [],
    difficultSubjects: [], struggles: [], focusTime: "15", supportStyles: [],
  });

  const totalSteps = 7;
  const toggleInArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const canProceed = () => {
    switch (step) {
      case 0: return data.name.trim() !== "" && data.age !== "";
      case 1: return data.avatar !== "";
      case 2: return data.schoolLevel !== "";
      case 3: return data.favoriteSubjects.length > 0;
      case 4: return data.struggles.length > 0;
      case 5: return data.supportStyles.length > 0;
      case 6: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      const profile = await createChildProfile({
        name: data.name,
        avatar_emoji: data.avatar,
        age: parseInt(data.age) || undefined,
        school_level: data.schoolLevel,
        favorite_subjects: data.favoriteSubjects,
        difficult_subjects: data.difficultSubjects,
        struggles: data.struggles,
        focus_time: parseInt(data.focusTime) || 15,
        support_style: data.supportStyles.join(","),
      });
      setSaving(false);
      if (profile) {
        setActiveChildProfileId(profile.id);
        localStorage.setItem("inschool-profile", JSON.stringify({
          name: data.name, age: data.age, schoolLevel: data.schoolLevel,
          favoriteSubjects: data.favoriteSubjects, focusTime: data.focusTime,
          supportStyles: data.supportStyles,
        }));
        navigate("/dashboard");
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come si chiama il bambino?</h2><p className="text-muted-foreground">Il coach lo chiamerà per nome.</p></div>
            <div className="space-y-4">
              <input type="text" placeholder="Nome del bambino" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg" />
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Quanti anni ha?</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }, (_, i) => (i + 6).toString()).map((age) => (
                    <button key={age} onClick={() => setData({ ...data, age })} className={`w-12 h-12 rounded-xl font-display font-semibold text-lg transition-all ${data.age === age ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{age}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Scegli un avatar per {data.name}</h2><p className="text-muted-foreground">Lo vedrà nella schermata di selezione profilo.</p></div>
            <div className="grid grid-cols-4 gap-3">
              {avatarOptions.map((emoji) => (
                <button key={emoji} onClick={() => setData({ ...data, avatar: emoji })} className={`text-4xl p-4 rounded-2xl border-2 transition-all ${data.avatar === emoji ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}>{emoji}</button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Che classe fa {data.name}?</h2></div>
            <div className="space-y-3">
              {schoolLevels.map((level) => (
                <button key={level.id} onClick={() => setData({ ...data, schoolLevel: level.id })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.schoolLevel === level.id ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="font-medium text-foreground">{level.label}</span></button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Quali materie piacciono a {data.name}?</h2></div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Piacciono 💚</label>
              <div className="flex flex-wrap gap-2 mb-6">
                {subjects.map((s) => (<button key={`f-${s}`} onClick={() => setData({ ...data, favoriteSubjects: toggleInArray(data.favoriteSubjects, s) })} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${data.favoriteSubjects.includes(s) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{s}</button>))}
              </div>
              <label className="text-sm font-medium text-foreground mb-3 block">Difficili 🤔</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (<button key={`d-${s}`} onClick={() => setData({ ...data, difficultSubjects: toggleInArray(data.difficultSubjects, s) })} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${data.difficultSubjects.includes(s) ? "bg-terracotta text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{s}</button>))}
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Cosa succede quando studia?</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {struggles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, struggles: toggleInArray(data.struggles, s.id) })} className={`text-left px-4 py-4 rounded-2xl border transition-all ${data.struggles.includes(s.id) ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="text-xl mr-2">{s.emoji}</span><span className="font-medium text-foreground text-sm">{s.label}</span></button>))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come deve aiutarlo il coach?</h2></div>
            <div className="space-y-3">
              {supportStyles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, supportStyles: toggleInArray(data.supportStyles, s.id) })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.supportStyles.includes(s.id) ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="text-xl mr-3">{s.emoji}</span><span className="font-medium text-foreground">{s.label}</span></button>))}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Quanto riesce a concentrarsi?</h2></div>
            <div className="space-y-3">
              {[{ val: "10", label: "10 minuti", desc: "Per iniziare" }, { val: "15", label: "15 minuti", desc: "Equilibrio" }, { val: "20", label: "20 minuti", desc: "Già bravo" }, { val: "25", label: "25 minuti", desc: "Campione di focus" }].map((opt) => (
                <button key={opt.val} onClick={() => setData({ ...data, focusTime: opt.val })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.focusTime === opt.val ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}>
                  <div className="flex items-center justify-between"><div><span className="font-medium text-foreground">{opt.label}</span><span className="text-sm text-muted-foreground ml-2">— {opt.desc}</span></div>{data.focusTime === opt.val && <Check className="w-4 h-4 text-primary" />}</div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-primary-foreground" /></div>
            <span className="font-display text-lg font-semibold text-foreground">Nuovo profilo</span>
          </div>
          <span className="text-sm text-muted-foreground">{step + 1} di {totalSteps}</span>
        </div>
        <div className="max-w-lg mx-auto mt-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} transition={spring} />
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-start justify-center px-6 pt-8 pb-32">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={spring}>
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : navigate("/profiles")} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>
          <Button onClick={next} disabled={!canProceed() || saving} className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-6 disabled:opacity-40">
            {step === totalSteps - 1 ? (saving ? "Salvataggio..." : "Crea profilo!") : "Avanti"}<ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
