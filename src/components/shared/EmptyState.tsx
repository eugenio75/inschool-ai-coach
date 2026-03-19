import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {ctaLabel && onCta && (
        <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
