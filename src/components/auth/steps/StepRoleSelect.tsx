import { useState } from "react";
import { GraduationCap, BookOpen, Users, ArrowLeft } from "lucide-react";
import { StepIndicator } from "../StepIndicator";
import { LegalDisclaimer } from "../LegalDisclaimer";
import type { RegistrationRole } from "../RegistrationFlow";

interface StepRoleSelectProps {
  age: number;
  onSelect: (role: RegistrationRole) => void;
  onBack: () => void;
  onSwitchToLogin: () => void;
}

const roles: { id: RegistrationRole; icon: React.ReactNode; title: string; subtitle: string; iconBg: string }[] = [
  {
    id: "studente",
    icon: <GraduationCap className="w-6 h-6" />,
    title: "Studente",
    subtitle: "Scuola superiore o università",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    id: "docente",
    icon: <BookOpen className="w-6 h-6" />,
    title: "Docente",
    subtitle: "Insegnante o formatore",
    iconBg: "bg-accent/20 text-accent-foreground",
  },
  {
    id: "genitore",
    icon: <Users className="w-6 h-6" />,
    title: "Genitore",
    subtitle: "Gestisco i profili dei miei figli",
    iconBg: "bg-secondary text-secondary-foreground",
  },
];

export function StepRoleSelect({ age, onSelect, onBack, onSwitchToLogin }: StepRoleSelectProps) {
  const [error, setError] = useState<string | null>(null);
  const [showMinorBanner, setShowMinorBanner] = useState(false);

  const handleSelect = (role: RegistrationRole) => {
    setError(null);
    setShowMinorBanner(false);

    // Check age restrictions before proceeding
    if (role === "docente" && age < 18) {
      setError("Per registrarsi come Docente devi avere almeno 18 anni.");
      return;
    }
    if (role === "genitore" && age < 18) {
      setError("Per gestire profili di minori devi avere almeno 18 anni ai sensi dell'art. 8 GDPR.");
      return;
    }

    // For minor students, show banner then proceed
    if (role === "studente" && age >= 14 && age < 18) {
      setShowMinorBanner(true);
      // Still proceed after showing banner
    }

    onSelect(role);
  };

  return (
    <div>
      <StepIndicator currentStep={2} totalSteps={3} />

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Indietro
      </button>

      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Come usi InSchool?
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center font-medium">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => handleSelect(role.id)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card text-left transition-all duration-200 hover:shadow-md hover:border-primary/30 group"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${role.iconBg} transition-transform duration-200 group-hover:scale-105`}>
              {role.icon}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-[15px]">{role.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{role.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {showMinorBanner && (
        <div className="mb-4 p-3 rounded-xl bg-secondary border border-border text-xs text-muted-foreground text-center leading-relaxed">
          Poiché hai meno di 18 anni, ti chiederemo il consenso di un genitore durante la configurazione del profilo.
        </div>
      )}

      <div className="text-center">
        <span className="text-sm text-muted-foreground">Hai già un account?</span>
        <button
          onClick={onSwitchToLogin}
          className="ml-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
        >
          Accedi
        </button>
      </div>

      <LegalDisclaimer />
    </div>
  );
}
