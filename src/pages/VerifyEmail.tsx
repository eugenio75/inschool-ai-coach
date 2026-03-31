import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MailCheck, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FloatingBackButton } from "@/components/shared/FloatingBackButton";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = new URLSearchParams(window.location.search).get("email") || "";

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResending(true);
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResent(true);
    setCooldown(60);

    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setResent(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <FloatingBackButton />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-md text-center"
      >
        <div className="bg-card border border-border rounded-2xl p-8 shadow-soft">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Controlla la tua email
          </h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Abbiamo inviato un link di verifica a{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "il tuo indirizzo email"
            )}
            . Clicca sul link per attivare il tuo account.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              variant="outline"
              className="w-full rounded-xl"
            >
              {resending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {cooldown > 0
                ? `Rinvia tra ${cooldown}s`
                : resent
                ? "Email rinviata!"
                : "Rinvia email di verifica"}
            </Button>

            <Button
              onClick={() => navigate("/auth")}
              variant="ghost"
              className="w-full rounded-xl text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna al login
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Non trovi l'email? Controlla la cartella spam o{" "}
            <button
              onClick={() => navigate("/auth")}
              className="text-primary hover:underline font-medium"
            >
              cambia indirizzo email
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}