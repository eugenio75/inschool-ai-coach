import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalDisclaimer } from "../LegalDisclaimer";

interface StepUnderAgeProps {
  onParentRegister: () => void;
  onMagicCode: () => void;
  onBack: () => void;
}

export function StepUnderAge({ onParentRegister, onMagicCode, onBack }: StepUnderAgeProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Indietro
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          InSchool ti aspetta presto!
        </h1>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-sm mx-auto">
          Per registrarsi in autonomia servono almeno 14 anni. Puoi comunque usare InSchool subito:
          chiedi al tuo genitore o tutore di creare un account e aggiungere il tuo profilo.
          Riceverai un <span className="font-semibold text-foreground">Codice Magico</span> personale per accedere.
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={onParentRegister} className="w-full h-12 rounded-xl font-bold">
          Il mio genitore vuole registrarsi
        </Button>
        <Button onClick={onMagicCode} variant="outline" className="w-full h-11 rounded-xl font-medium">
          Ho già un Codice Magico
        </Button>
      </div>

      <LegalDisclaimer />
    </div>
  );
}
