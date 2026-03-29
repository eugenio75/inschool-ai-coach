import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LangContext";

export function FloatingBackButton() {
  const navigate = useNavigate();
  const { t } = useLang();

  return (
    <button
      onClick={() => navigate(-1)}
      className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-foreground shadow-soft backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      type="button"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{t("back_button")}</span>
    </button>
  );
}