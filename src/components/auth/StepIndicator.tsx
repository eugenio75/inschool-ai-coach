import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div
            key={step}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              isCompleted
                ? "bg-primary text-primary-foreground"
                : isActive
                ? "bg-primary text-primary-foreground"
                : "border-2 border-muted-foreground/30"
            }`}
          >
            {isCompleted ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <span className={`text-xs font-semibold ${isActive ? "" : "text-muted-foreground/50"}`}>
                {step}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
