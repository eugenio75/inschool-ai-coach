interface AppWordmarkProps {
  className?: string;
  compact?: boolean;
}

export function AppWordmark({ className = "", compact = false }: AppWordmarkProps) {
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`.trim()}>
      <span className={`font-display font-black tracking-tight ${compact ? "text-lg sm:text-xl" : "text-2xl"}`}>
        <span className="text-foreground">Sar</span>
        <span className="text-primary">AI</span>
      </span>
      <span className="text-xs font-medium text-muted-foreground">Better</span>
    </div>
  );
}