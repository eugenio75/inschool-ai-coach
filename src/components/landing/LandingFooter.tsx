import { Link } from "react-router-dom";
import { useLang } from "@/contexts/LangContext";

export function LandingFooter() {
  const { t } = useLang();

  return (
    <footer className="text-slate-400 py-12 px-6" style={{ backgroundColor: "#0F172A" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <p className="font-display font-bold text-white text-lg mb-1">
              InSchool <span className="text-slate-500 font-normal text-sm">— Do Better</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">AzarLabs · Tenks S.r.l.s.</p>
            <p className="text-xs text-slate-500">contact@inschool.ai</p>
          </div>

          {/* Prodotto */}
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500 mb-3 tracking-wider">
              {t("home_nav_come")}
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/studenti" className="text-sm hover:text-white transition-colors">
                {t("home_nav_studenti")}
              </Link>
              <Link to="/docenti" className="text-sm hover:text-white transition-colors">
                {t("home_nav_docenti")}
              </Link>
              <Link to="/security" className="text-sm hover:text-white transition-colors">
                {t("home_nav_sicurezza")}
              </Link>
            </div>
          </div>

          {/* Legale */}
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500 mb-3 tracking-wider">Legal</p>
            <div className="flex flex-col gap-2">
              <Link to="/privacy" className="text-sm hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/verify" className="text-sm hover:text-white transition-colors">
                {t("nav_verify")}
              </Link>
              <span className="text-sm text-slate-500">EU AI Act Compliance</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 text-center">
          <p className="text-xs text-slate-500">
            © 2026 InSchool · AzarLabs · Tutti i diritti riservati / All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
