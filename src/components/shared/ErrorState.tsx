import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Errore nel caricamento dei dati.", onRetry }: ErrorStateProps) {
  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}
