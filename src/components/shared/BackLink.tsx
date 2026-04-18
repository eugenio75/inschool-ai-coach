import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackLinkProps {
  /** Destination label, e.g. "alla classe", "alla home". Rendered as "Torna {label}". */
  label: string;
  /** Override default navigate(-1) */
  to?: string;
  className?: string;
}

/**
 * Inline back link "← Torna a [destinazione]" placed above page titles, left-aligned.
 * Standardized for teacher-facing pages.
 */
export function BackLink({ label, to, className = "" }: BackLinkProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
    else navigate(-1);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>Torna {label}</span>
    </button>
  );
}
