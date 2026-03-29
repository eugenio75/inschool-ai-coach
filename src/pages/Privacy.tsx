import { motion } from "framer-motion";
import { ArrowLeft, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/shared/FloatingBackButton";

const Privacy = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <FloatingBackButton />

      <main className="pb-20 px-6 pt-24 max-w-4xl mx-auto">
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
