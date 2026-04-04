import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, MailCheck, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/contexts/LangContext";


export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://inschool.azarlabs.com/reset-password",
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <FloatingBackButton />
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
            <MailCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("forgot_sent_title")}</h1>
          <p className="text-muted-foreground mb-6">{t("forgot_sent_body")}</p>
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("forgot_back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <FloatingBackButton />
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 shadow-soft">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("forgot_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("forgot_subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1.5">{t("forgot_email_label")}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("forgot_email_placeholder")}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("forgot_help_text")}</p>
          <Button type="submit" disabled={loading || !email.trim()} className="w-full h-12 rounded-xl font-bold">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : t("forgot_send_button")}
          </Button>
        </form>

        <Link
          to="/auth"
          className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t("forgot_back")}
        </Link>
      </div>
    </div>
  );
}
