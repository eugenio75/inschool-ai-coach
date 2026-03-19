interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionTitle({ children, className }: SectionTitleProps) {
  return (
    <h2 className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 ${className || ""}`}>
      {children}
    </h2>
  );
}
