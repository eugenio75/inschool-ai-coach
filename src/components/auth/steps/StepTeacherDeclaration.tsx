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

  const canSubmit = schoolName.trim() && schoolCity.trim() && schoolOrder && mainSubject.trim();

  const handleSchoolChange = (name: string, code: string | null, city: string) => {
    setSchoolName(name);
    setSchoolVerified(!!code);
    setMiurCode(code || "");
    if (city) setSchoolCity(city);
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
        {/* School name with autocomplete */}
        <SchoolAutocomplete
          value={schoolName}
          onChange={handleSchoolChange}
          placeholder="Nome istituto"
          className={inputClass}
        />

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
