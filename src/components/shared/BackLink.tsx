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
 * Back link "← Torna a [destinazione]" pinned to the far-left of the page,
 * vertically aligned with the page title. Sits below the topbar logo.
 *
 * Place this as a sibling of the page header card (NOT inside it).
 * The parent should be `relative` (or use the default page layout where
 * the wrapper is `relative`).
 *
 * The component pins itself with `absolute left-4 sm:left-5 top-{N}` —
 * use the `topClass` prop to fine-tune vertical alignment with the page title.
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
      className={`absolute left-4 sm:left-5 top-7 sm:top-11 z-10 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>Torna {label}</span>
    </button>
  );
}
