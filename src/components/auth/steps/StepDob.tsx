import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "../StepIndicator";
import { LegalDisclaimer } from "../LegalDisclaimer";

interface StepDobProps {
  onContinue: (dob: string, age: number) => void;
  onSwitchToLogin: () => void;
}

function calcAge(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let a = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
  return a;
}

export function StepDob({ onContinue, onSwitchToLogin }: StepDobProps) {
  const [dobStr, setDobStr] = useState("");

  const age = calcAge(dobStr);
  const isValid = dobStr !== "" && age !== null && age >= 0 && age < 120;
  const isFuture = dobStr !== "" && new Date(dobStr) > new Date();

  return (
    <div>
      <StepIndicator currentStep={1} totalSteps={3} />

      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Quando sei nato/a?
        </h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
          Usiamo questa info solo per personalizzare la tua esperienza e garantire la tua sicurezza online
        </p>
      </div>

      <div className="max-w-[280px] mx-auto mb-8">
        <input
          type="date"
          value={dobStr}
          onChange={(e) => setDobStr(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full px-4 py-3.5 rounded-xl bg-muted/50 border border-border text-foreground text-center text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200"
        />
      </div>

      <Button
        onClick={() => isValid && age !== null && onContinue(dobStr, age)}
        disabled={!isValid || isFuture}
        className="w-full h-12 rounded-xl font-bold"
      >
        Continua <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      <div className="mt-6 text-center">
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
