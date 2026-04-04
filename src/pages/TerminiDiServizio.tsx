import { useTranslation } from "react-i18next";

export default function TerminiDiServizio() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-24">

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">{t("tos_title")}</h1>
        <p className="text-sm text-muted-foreground mb-10">{t("legal_updated")}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s1_title")}</h2>
            <p>{t("tos_s1_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s2_title")}</h2>
            <p>{t("tos_s2_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s3_title")}</h2>
            <p>{t("tos_s3_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s4_title")}</h2>
            <p>{t("tos_s4_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s5_title")}</h2>
            <p>{t("tos_s5_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s6_title")}</h2>
            <p>{t("tos_s6_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s7_title")}</h2>
            <p>{t("tos_s7_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s8_title")}</h2>
            <p>{t("tos_s8_body")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">{t("tos_s9_title")}</h2>
            <p>Tenks S.r.l.s. — <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
