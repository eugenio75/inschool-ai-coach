import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LangContext";

interface PageBackButtonProps {
  /** Override default navigate(-1) */
  to?: string;
  /** Custom label — defaults to i18n "back_button" */
  label?: string;
  className?: string;
}

/**
 * Consistent inline back button for page headers.
 * Sits inside the normal page flow (not floating/fixed).
 */
export function PageBackButton({ to, label, className = "" }: PageBackButtonProps) {
  const navigate = useNavigate();
  const { t } = useLang();

  const handleClick = () => {
    if (to) navigate(to);
    else navigate(-1);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label || t("back_button")}</span>
    </button>
  );
}
