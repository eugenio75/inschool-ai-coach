import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from "../StepIndicator";
import { LegalDisclaimer } from "../LegalDisclaimer";
import type { RegistrationRole } from "../RegistrationFlow";

interface StepCredentialsProps {
  role: RegistrationRole;
  dob: string;
  age: number;
  onBack: () => void;
  onSwitchToLogin: () => void;
}

const roleToSchoolLevel: Record<RegistrationRole, string> = {
  studente: "superiori",
  docente: "docente",
  genitore: "alunno",
};

export function StepCredentials({ role, dob, age, onBack, onSwitchToLogin }: StepCredentialsProps) {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<"m" | "f" | null>(null);

  const needsParentalConsent = role === "studente" && age >= 14 && age < 18;
  const schoolLevel = roleToSchoolLevel[role];

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    password.length >= 6 &&
    acceptTerms &&
    (!needsParentalConsent || parentalConsent) &&
    (role !== "docente" || gender !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Final age validation (client-side)
    if (role === "studente" && age < 14) {
      toast({ title: "Devi avere almeno 14 anni per registrarti.", variant: "destructive" });
      return;
    }
    if (role === "docente" && age < 18) {
      toast({ title: "Devi avere almeno 18 anni per registrarti come docente.", variant: "destructive" });
      return;
    }
    if (role === "genitore" && age < 18) {
      toast({ title: "Devi avere almeno 18 anni per registrarti come genitore.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) throw error;

      // Store signup metadata for post-login profile creation
      localStorage.setItem(
        "inschool-signup-meta",
        JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          school_level: schoolLevel,
          date_of_birth: dob,
          age,
          ...(role === "docente" && gender ? { gender } : {}),
        })
      );

      // Store GDPR consents
      const now = new Date().toISOString();
      localStorage.setItem(
        "inschool-pending-consents",
        JSON.stringify({
          privacy_accepted: true,
          privacy_accepted_at: now,
          tos_accepted: true,
          tos_accepted_at: now,
          parental_consent: parentalConsent || null,
          parental_consent_at: parentalConsent ? now : null,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? now : null,
          age_at_registration: age,
          role_at_registration: schoolLevel,
        })
      );

      toast({ title: "Account creato! Controlla la tua email per confermare." });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast({ title: err.message || "Errore durante la registrazione", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 text-sm";

  return (
    <div>
      <StepIndicator currentStep={3} totalSteps={3} />

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Torna alla scelta
      </button>

      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Crea il tuo account
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Nome"
            className={inputClass}
          />
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Cognome"
            className={inputClass}
          />
        </div>

        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="Password (minimo 6 caratteri)"
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* GDPR Consents */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(!!v)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Ho letto e accetto la{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              e i{" "}
              <Link to="/termini-di-servizio" className="text-primary hover:underline">
                Termini di Servizio
              </Link>
            </span>
          </label>

          {needsParentalConsent && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={parentalConsent}
                onCheckedChange={(v) => setParentalConsent(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Confermo di avere il consenso di un genitore o tutore per utilizzare questo servizio AI
              </span>
            </label>
          )}

          {role === "genitore" && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={parentalConsent}
                onCheckedChange={(v) => setParentalConsent(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Confermo di essere il genitore o tutore legale e fornisco il consenso al trattamento dei dati del minore ai sensi dell'art. 8 GDPR
              </span>
            </label>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={marketingConsent}
              onCheckedChange={(v) => setMarketingConsent(!!v)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Acconsento a ricevere aggiornamenti e novità di InSchool
            </span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full h-12 rounded-xl font-bold mt-2"
        >
          {loading ? (
            <Loader2 className="animate-spin w-5 h-5 mx-auto" />
          ) : (
            "Crea il mio account →"
          )}
        </Button>
      </form>

      <div className="mt-5 text-center">
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
