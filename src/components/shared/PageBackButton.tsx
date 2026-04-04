import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageBackButtonProps {
  /** Override default navigate(-1) */
  to?: string;
  className?: string;
}

/**
 * Icon-only back arrow for page headers.
 * Renders inline — place next to the page title on the same row.
 */
export function PageBackButton({ to, className = "" }: PageBackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
    else navigate(-1);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      aria-label="Back"
      className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
