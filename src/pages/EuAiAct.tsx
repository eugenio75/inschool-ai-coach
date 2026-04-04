import { useTranslation } from "react-i18next";

export default function EuAiAct() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-24">

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">{t("euai_page_title")}</h1>
        <p className="text-sm text-muted-foreground mb-10">{t("legal_updated")}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">{t("euai_commitment_title")}</h2>
            <p>{t("euai_commitment_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("euai_classification_title")}</h2>
            <p>{t("euai_classification_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("euai_measures_title")}</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{t("euai_m1_label")}</strong> {t("euai_m1_body")}</li>
              <li><strong>{t("euai_m2_label")}</strong> {t("euai_m2_body")}</li>
              <li><strong>{t("euai_m3_label")}</strong> {t("euai_m3_body")}</li>
              <li><strong>{t("euai_m4_label")}</strong> {t("euai_m4_body")}</li>
              <li><strong>{t("euai_m5_label")}</strong> {t("euai_m5_body")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("euai_blockchain_title")}</h2>
            <p>{t("euai_blockchain_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("euai_contact_title")}</h2>
            <p>{t("euai_contact_body")} <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
