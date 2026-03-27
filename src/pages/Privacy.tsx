import { motion } from "framer-motion";
import { ArrowLeft, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const Privacy = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t("legal_back")}
          </Button>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="w-16 h-16 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center mb-8">
            <Scale className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-6">
            {t("privacy_title")}
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            {t("privacy_updated")}
          </p>

          <div className="prose prose-neutral dark:prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary">
            <h3>{t("privacy_s1_title")}</h3>
            <p>{t("privacy_s1_body")}</p>

            <h3>{t("privacy_s2_title")}</h3>
            <p>{t("privacy_s2_body")}</p>

            <h3>{t("privacy_s3_title")}</h3>
            <p>{t("privacy_s3_body")}</p>

            <h3>{t("privacy_s4_title")}</h3>
            <p>{t("privacy_s4_body")}</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Privacy;
