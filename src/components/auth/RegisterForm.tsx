import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, MapPin, Building2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { AuthRole } from "./RoleSelector";

interface RegisterFormProps {
  selectedRole: AuthRole;
  onBack: () => void;
}

const roleToSchoolLevel: Record<AuthRole, string> = {
  studente_scuola: "superiori",
  universitario: "universitario",
  docente: "docente",
  genitore: "alunno",
  adulto: "superiori",
};

const roleTitles: Record<AuthRole, string> = {
  studente_scuola: "Registrazione Studente",
  universitario: "Registrazione Universitario",
  docente: "Registrazione Docente",
  genitore: "Registrazione Genitore",
  adulto: "Registrazione Adulto",
};

export function RegisterForm({ selectedRole, onBack }: RegisterFormProps) {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobStr, setDobStr] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [locationStr, setLocationStr] = useState("");
  const [materiaDocente, setMateriaDocente] = useState("");
  const [ordineDocente, setOrdineDocente] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let autocomplete: any = null;
    if (locationInputRef.current && (window as any).google) {
      autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, { types: ["(cities)"] });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete?.getPlace();
        if (place?.formatted_address) setLocationStr(place.formatted_address);
      });
    }
    return () => { if (autocomplete) (window as any).google.maps.event.clearInstanceListeners(autocomplete); };
  }, []);

  const getAgeFromDob = (d: string): number | null => {
    if (!d) return null;
    const dob = new Date(d);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    return a;
  };

  const calculatedAge = getAgeFromDob(dobStr);
  const needsParentalConsent = selectedRole === "studente_scuola" && calculatedAge !== null && calculatedAge < 18;
  const schoolLevel = roleToSchoolLevel[selectedRole];

  // For "studente_scuola" who enters DOB showing they're < 14
  const isUnderageStudent = selectedRole === "studente_scuola" && calculatedAge !== null && calculatedAge < 14;
  const needsDob = selectedRole !== "genitore"; // All except parent need DOB
  const needsSchool = ["studente_scuola", "universitario", "docente"].includes(selectedRole);
  const needsLocation = ["studente_scuola", "universitario", "docente"].includes(selectedRole);
  const isDocente = selectedRole === "docente";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!email.trim() || !password.trim()) return;
    if (selectedRole !== "genitore" && (!firstName || !lastName)) {
      toast({ title: "Compila nome e cognome", variant: "destructive" }); return;
    }

    // Age validations
    if (needsDob && !dobStr) {
      toast({ title: "Inserisci la tua data di nascita", variant: "destructive" }); return;
    }

    if (selectedRole === "studente_scuola" && calculatedAge !== null && calculatedAge < 14) {
      toast({
        title: "Hai meno di 14 anni",
        description: "Chiedi al tuo genitore di registrarsi e creare il tuo profilo dall'app. Potrai accedere con il Codice Magico.",
        variant: "destructive",
      });
      return;
    }

    if (selectedRole === "universitario" && calculatedAge !== null && calculatedAge < 18) {
      toast({ title: "Devi avere almeno 18 anni per registrarti come universitario.", variant: "destructive" }); return;
    }

    if (selectedRole === "docente" && calculatedAge !== null && calculatedAge < 18) {
      toast({ title: "Devi avere almeno 18 anni per registrarti come docente.", variant: "destructive" }); return;
    }

    if (isDocente && (!materiaDocente || !ordineDocente)) {
      toast({ title: "Seleziona materia e ordine scolastico", variant: "destructive" }); return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) throw error;

      // Store signup metadata
      const meta: any = {
        name: selectedRole === "genitore" ? email.split("@")[0] : `${firstName} ${lastName}`,
        school_level: schoolLevel,
        city: locationStr || null,
        school_name: schoolName || null,
        date_of_birth: dobStr || null,
        age: calculatedAge,
      };
      if (isDocente) {
        meta.materia_principale = materiaDocente;
        meta.ordine_scolastico = ordineDocente;
      }
      localStorage.setItem("inschool-signup-meta", JSON.stringify(meta));

      // Store GDPR consents
      localStorage.setItem("inschool-pending-consents", JSON.stringify({
        privacy_accepted: true, privacy_accepted_at: new Date().toISOString(),
        tos_accepted: true, tos_accepted_at: new Date().toISOString(),
        parental_consent: parentalConsent || null,
        parental_consent_at: parentalConsent ? new Date().toISOString() : null,
        marketing_consent: marketingConsent,
        marketing_consent_at: marketingConsent ? new Date().toISOString() : null,
        age_at_registration: calculatedAge,
        role_at_registration: schoolLevel,
      }));

      toast({ title: "Account creato! Controlla la tua email per confermare la registrazione." });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast({ title: err.message || "Errore durante la registrazione", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors";
  const inputSmClass = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors";
  const labelSmClass = "text-xs font-semibold text-muted-foreground mb-1.5 block";

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Torna alla scelta ruolo
      </button>

      <div className="text-center mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          {roleTitles[selectedRole]}
        </h1>
      </div>

      {/* Underage student warning */}
      {isUnderageStudent && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center dark:bg-amber-950/30 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Hai meno di 14 anni? Chiedi al tuo genitore di registrarsi come "Genitore" e di creare il tuo profilo. Potrai accedere con il Codice Magico!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name fields — not for parent role */}
        {selectedRole !== "genitore" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelSmClass}>Nome</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Mario" className={inputSmClass} />
              </div>
            </div>
            <div>
              <label className={labelSmClass}>Cognome</label>
              <input required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rossi"
                className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors" />
            </div>
          </div>
        )}

        {/* DOB — all except parent */}
        {needsDob && (
          <div>
            <label className={labelSmClass}>Data di nascita</label>
            <input required type="date" value={dobStr} onChange={e => setDobStr(e.target.value)} max={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors" />
          </div>
        )}

        {/* Docente-specific fields */}
        {isDocente && (
          <>
            <div>
              <label className={labelSmClass}>Materia principale</label>
              <select required value={materiaDocente} onChange={e => setMateriaDocente(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors">
                <option value="" disabled>Seleziona materia</option>
                {["Matematica","Fisica","Chimica","Italiano","Latino","Greco","Storia","Filosofia","Inglese","Francese","Spagnolo","Tedesco","Informatica","Scienze","Arte","Musica","Educazione Fisica","Educazione Civica","Diritto","Economia","Geografia","Religione","Tecnologia"].map(m =>
                  <option key={m} value={m}>{m}</option>
                )}
              </select>
            </div>
            <div>
              <label className={labelSmClass}>Ordine scolastico</label>
              <select required value={ordineDocente} onChange={e => setOrdineDocente(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors">
                <option value="" disabled>Seleziona ordine</option>
                {["Primaria","Secondaria I grado","Secondaria II grado","Università","Formazione Professionale"].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </div>
          </>
        )}

        {/* School name */}
        {needsSchool && (
          <div>
            <label className={labelSmClass}>
              {isDocente ? "Nome Istituto" : selectedRole === "universitario" ? "Università" : "Nome Istituto / Scuola"}
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Es. Liceo Da Vinci"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground placeholder-muted-foreground focus:border-primary transition-colors" />
            </div>
          </div>
        )}

        {/* City */}
        {needsLocation && (
          <div>
            <label className={labelSmClass}>Città</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input ref={locationInputRef} type="text" placeholder="Ricerca città..." onChange={e => setLocationStr(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground placeholder-muted-foreground focus:border-primary transition-colors" />
            </div>
          </div>
        )}

        {/* Email + Password — always */}
        <div>
          <label className="text-sm font-semibold text-foreground block mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-foreground block mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={6} placeholder="Minimo 6 caratteri" className={inputClass} />
          </div>
        </div>

        {/* GDPR Consents */}
        <div className="space-y-3 mt-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(!!v)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Ho letto e accetto la <Link to="/privacy-policy" className="text-primary underline">Privacy Policy</Link> e i <Link to="/termini-di-servizio" className="text-primary underline">Termini di Servizio</Link>
            </span>
          </label>

          {/* Parental consent for student under 18 */}
          {needsParentalConsent && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={parentalConsent} onCheckedChange={(v) => setParentalConsent(!!v)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Ho il consenso dei miei genitori per utilizzare questo servizio, incluso il trattamento dei miei dati da parte di un sistema AI
              </span>
            </label>
          )}

          {/* Parental consent for parent managing minors */}
          {selectedRole === "genitore" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={parentalConsent} onCheckedChange={(v) => setParentalConsent(!!v)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Confermo di essere il genitore o tutore legale e fornisco il consenso al trattamento dei dati del minore ai sensi dell'art. 8 GDPR
              </span>
            </label>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={marketingConsent} onCheckedChange={(v) => setMarketingConsent(!!v)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Acconsento a ricevere comunicazioni su novità e aggiornamenti di InSchool
            </span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={loading || !acceptTerms || (needsParentalConsent && !parentalConsent) || (selectedRole === "genitore" && !parentalConsent)}
          className="w-full h-12 rounded-xl font-bold shadow-sm mt-2"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Crea Account"}
        </Button>
      </form>
    </div>
  );
}
