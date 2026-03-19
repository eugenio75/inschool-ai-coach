import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400"];
  const labels = ["Debole", "Discreta", "Buona", "Forte"];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? colors[score - 1] : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[score - 1] || "Troppo corta"}</p>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setHasRecovery(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Le password non corrispondono", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "La password deve avere almeno 6 caratteri", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 2000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Password aggiornata!</h1>
          <p className="text-muted-foreground">Verrai reindirizzato alla pagina di accesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 shadow-soft">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reimposta password</h1>
          <p className="text-sm text-muted-foreground mt-1">Scegli una nuova password sicura</p>
        </div>

        {!hasRecovery && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 text-sm text-amber-600 dark:text-amber-400">
            Link di reset non valido o scaduto. Richiedi un nuovo link dalla pagina di accesso.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1.5">Nuova password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary transition-colors" />
            </div>
            <PasswordStrength password={password} />
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1.5">Conferma password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" required minLength={6} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary transition-colors" />
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs text-destructive mt-1">Le password non corrispondono</p>
            )}
          </div>
          <Button type="submit" disabled={loading || !hasRecovery || password.length < 6 || password !== confirm}
            className="w-full h-12 rounded-xl font-bold">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Aggiorna password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
