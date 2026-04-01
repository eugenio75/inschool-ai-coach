import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "../StepIndicator";
import { LegalDisclaimer } from "../LegalDisclaimer";
import { SchoolAutocomplete } from "@/components/shared/SchoolAutocomplete";

interface StepTeacherDeclarationProps {
  onComplete: (declaration: TeacherDeclaration) => void;
  onBack: () => void;
}

export interface TeacherDeclaration {
  school_name: string;
  school_city: string;
  school_order: string;
  main_subject: string;
  school_verified: boolean;
  miur_code: string;
}

const schoolOrders = [
  { value: "infanzia", label: "Infanzia" },
  { value: "primaria", label: "Primaria" },
  { value: "secondaria_1", label: "Secondaria I grado" },
  { value: "secondaria_2", label: "Secondaria II grado" },
  { value: "altro", label: "Altro" },
];

export function StepTeacherDeclaration({ onComplete, onBack }: StepTeacherDeclarationProps) {
  const [schoolName, setSchoolName] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolOrder, setSchoolOrder] = useState("");
  const [mainSubject, setMainSubject] = useState("");
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [miurCode, setMiurCode] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const canSubmit = schoolName.trim() && schoolCity.trim() && schoolOrder && mainSubject.trim();

  useEffect(() => {
    if (schoolName.length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.functions.invoke("miur-schools", {
          body: { query: schoolName, city: schoolCity },
        });
        setSuggestions(data?.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 400);
  }, [schoolName, schoolCity]);

  const selectSchool = (s: any) => {
    setSchoolName(s.name);
    if (s.city) setSchoolCity(s.city);
    setSchoolVerified(s.verified);
    setMiurCode(s.code || "");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onComplete({
      school_name: schoolName.trim(),
      school_city: schoolCity.trim(),
      school_order: schoolOrder,
      main_subject: mainSubject.trim(),
      school_verified: schoolVerified,
      miur_code: miurCode,
    });
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 text-sm";

  return (
    <div>
      <StepIndicator currentStep={3} totalSteps={4} />

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Indietro
      </button>

      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Informazioni professionali
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Queste informazioni ci aiutano a personalizzare la tua esperienza
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* School name with MIUR autocomplete */}
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => {
                setSchoolName(e.target.value);
                setSchoolVerified(false);
                setMiurCode("");
              }}
              placeholder="Nome istituto"
              className={`${inputClass} pr-10`}
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-md max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectSchool(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors text-sm flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{s.name}</p>
                    {s.city && <p className="text-xs text-muted-foreground">{s.city}</p>}
                  </div>
                  {s.verified && <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {schoolVerified && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs">🟡</span>
              <span className="text-xs text-amber-600 font-medium">Istituto Riconosciuto</span>
            </div>
          )}
          {schoolName.length >= 3 && !schoolVerified && !searching && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs">⚪</span>
              <span className="text-xs text-muted-foreground">Non verificato</span>
            </div>
          )}
        </div>

        <input
          type="text"
          required
          value={schoolCity}
          onChange={(e) => setSchoolCity(e.target.value)}
          placeholder="Città"
          className={inputClass}
        />

        <select
          required
          value={schoolOrder}
          onChange={(e) => setSchoolOrder(e.target.value)}
          className={`${inputClass} ${!schoolOrder ? "text-muted-foreground" : ""}`}
        >
          <option value="" disabled>Ordine scolastico</option>
          {schoolOrders.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="text"
          required
          value={mainSubject}
          onChange={(e) => setMainSubject(e.target.value)}
          placeholder="Materia principale"
          className={inputClass}
        />

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl font-bold mt-2"
        >
          Continua →
        </Button>
      </form>

      <LegalDisclaimer />
    </div>
  );
}
