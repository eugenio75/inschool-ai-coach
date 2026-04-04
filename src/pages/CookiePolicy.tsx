import { useTranslation } from "react-i18next";

export default function CookiePolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-24">

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">{t("cookie_title")}</h1>
        <p className="text-sm text-muted-foreground mb-10">{t("legal_updated")}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">{t("cookie_what_title")}</h2>
            <p>{t("cookie_what_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("cookie_used_title")}</h2>
            <h3 className="text-base font-medium mt-4">{t("cookie_technical_title")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg mt-2">
                <thead><tr className="bg-muted"><th className="px-3 py-2 text-left">{t("cookie_col_name")}</th><th className="px-3 py-2 text-left">{t("cookie_col_purpose")}</th><th className="px-3 py-2 text-left">{t("cookie_col_duration")}</th></tr></thead>
                <tbody>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">session_token</td><td className="px-3 py-2">{t("cookie_session_purpose")}</td><td className="px-3 py-2">{t("cookie_session_duration")}</td></tr>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">preferences</td><td className="px-3 py-2">{t("cookie_prefs_purpose")}</td><td className="px-3 py-2">{t("cookie_prefs_duration")}</td></tr>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">cookie_consent</td><td className="px-3 py-2">{t("cookie_consent_purpose")}</td><td className="px-3 py-2">{t("cookie_consent_duration")}</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-medium mt-6">{t("cookie_analytics_title")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg mt-2">
                <thead><tr className="bg-muted"><th className="px-3 py-2 text-left">{t("cookie_col_name")}</th><th className="px-3 py-2 text-left">{t("cookie_col_purpose")}</th><th className="px-3 py-2 text-left">{t("cookie_col_duration")}</th></tr></thead>
                <tbody>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">analytics_id</td><td className="px-3 py-2">{t("cookie_analytics_purpose")}</td><td className="px-3 py-2">{t("cookie_analytics_duration")}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("cookie_third_title")}</h2>
            <p>{t("cookie_third_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("cookie_manage_title")}</h2>
            <p>{t("cookie_manage_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("cookie_consent_title")}</h2>
            <p>{t("cookie_consent_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t("cookie_contact_title")}</h2>
            <p>{t("cookie_contact_body")} <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
