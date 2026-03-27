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
            <p className="text-xs text-slate-500">inschool.privacy@azarlabs.com</p>
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
              <Link to="/privacy-policy" className="text-sm hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/termini-di-servizio" className="text-sm hover:text-white transition-colors">
                Termini di servizio
              </Link>
              <Link to="/cookie-policy" className="text-sm hover:text-white transition-colors">
                Cookie Policy
              </Link>
              <Link to="/eu-ai-act" className="text-sm hover:text-white transition-colors">
                EU AI Act Compliance
              </Link>
              <Link to="/verify" className="text-sm hover:text-white transition-colors">
                {t("nav_verify")}
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 text-center space-y-2">
          <p className="text-xs text-slate-500">
            © 2026 InSchool · AzarLabs · Tutti i diritti riservati / All rights reserved
          </p>
          <p className="text-xs text-slate-600">
            InSchool tratta i dati personali nel rispetto del GDPR (Reg. UE 2016/679). Titolare del trattamento: Tenks S.r.l.s. — inschool.privacy@azarlabs.com
          </p>
        </div>
      </div>
    </footer>
  );
}
