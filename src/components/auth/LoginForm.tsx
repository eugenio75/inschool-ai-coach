import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, KeyRound, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { loginWithChildCode } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { setChildSession } from "@/lib/childSession";

function ForgotPasswordInline() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://inschool.azarlabs.com/reset-password",
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
        Password dimenticata?
      </button>
    );
  }

  if (sent) {
    return (
      <div className="mt-4 bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
        <MailCheck className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Email inviata!</p>
        <p className="text-xs text-muted-foreground mt-1">Controlla la tua casella di posta e segui le istruzioni.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="mt-4 bg-muted/50 border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">Recupera la tua password</p>
      <div className="relative">
        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="La tua email"
          className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground outline-none focus:border-primary text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShow(false)} className="text-muted-foreground rounded-xl">Annulla</Button>
        <Button type="submit" size="sm" disabled={loading || !email.trim()} className="rounded-xl flex-1">
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "Invia link di reset"}
        </Button>
      </div>
    </form>
  );
}

const ADULT_ROLES = ["superiori", "universitario", "docente"];

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childCode, setChildCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMagicCode, setShowMagicCode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      if (!data.user) throw new Error("Login fallito");

      // Persist pending GDPR consents from signup
      const pendingConsents = localStorage.getItem("inschool-pending-consents");
      if (pendingConsents) {
        try {
          const c = JSON.parse(pendingConsents);
          await (supabase.from as any)("user_consents").insert({ user_id: data.user.id, ...c });
          localStorage.removeItem("inschool-pending-consents");
        } catch {}
      }

      // Check stored signup meta for profile creation
      const storedMeta = localStorage.getItem("inschool-signup-meta");
      if (storedMeta) {
        try {
          const meta = JSON.parse(storedMeta);
          const role = meta.school_level;
          if (ADULT_ROLES.includes(role)) {
            // Check if profile already exists
            const { data: existing } = await supabase
              .from("child_profiles")
              .select("*")
              .eq("parent_id", data.user.id)
              .eq("school_level", role)
              .maybeSingle();

            if (!existing) {
              const { data: created, error: createErr } = await supabase
                .from("child_profiles")
                .insert({
                  parent_id: data.user.id,
                  name: meta.name || data.user.email?.split("@")[0] || "Utente",
                  school_level: role,
                  onboarding_completed: false,
                  access_code: null,
                  avatar_emoji: null,
                  age: meta.age || null,
                  date_of_birth: meta.date_of_birth || null,
                  city: meta.city || null,
                  school_name: meta.school_name || null,
                } as any)
                .select()
                .single();

              if (!createErr && created) {
                setChildSession({
                  profileId: created.id,
                  accessCode: (created as any).access_code || "",
                  profile: created as any,
                });
                localStorage.removeItem("inschool-signup-meta");
                navigate("/onboarding");
                return;
              }
            } else {
              localStorage.removeItem("inschool-signup-meta");
              setChildSession({
                profileId: existing.id,
                accessCode: existing.access_code || "",
                profile: existing as any,
              });
              if (!existing.onboarding_completed) {
                navigate("/onboarding");
                return;
              }
            }
          }
        } catch {}
      }

      // Fetch all profiles and route accordingly
      const { data: profiles } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("parent_id", data.user.id);

      if (!profiles || profiles.length === 0) {
        navigate("/profiles");
        return;
      }

      // If only one adult profile, go directly
      if (profiles.length === 1 && ADULT_ROLES.includes(profiles[0].school_level || "")) {
        setChildSession({
          profileId: profiles[0].id,
          accessCode: profiles[0].access_code || "",
          profile: profiles[0] as any,
        });
        if (!profiles[0].onboarding_completed) {
          navigate("/onboarding");
        } else {
          navigate("/dashboard");
        }
        return;
      }

      // Multiple profiles → profile selector
      navigate("/profiles");
    } catch (err: any) {
      toast({ title: err.message || "Errore di accesso", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChildCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childCode.trim()) return;
    setLoading(true);
    try {
      await loginWithChildCode(childCode);
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: err.message || "Codice errato", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Bentornato su InSchool
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Accedi al tuo account
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-foreground block mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-foreground block mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={6} placeholder="••••••••" className={inputClass} />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold shadow-sm">
          {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Accedi"}
        </Button>
      </form>

      <ForgotPasswordInline />
      <Link to="/forgot-password" className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors">
        Vai alla pagina di recupero password →
      </Link>

      {/* Magic Code section */}
      <div className="h-[1px] bg-border w-full relative my-6">
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-4 text-xs font-bold text-muted-foreground tracking-wider">OPPURE</span>
      </div>

      {!showMagicCode ? (
        <button
          onClick={() => setShowMagicCode(true)}
          className="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Accedi con Codice Magico (studente minorenne) →
        </button>
      ) : (
        <form onSubmit={handleChildCode} className="space-y-3 bg-primary/5 p-5 rounded-2xl border border-primary/20">
          <label className="text-sm font-bold text-foreground block text-center">Codice Magico Studente</label>
          <p className="text-xs text-primary text-center mb-2">Utilizza il codice generato dal genitore</p>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
            <input
              placeholder="ES. LUNA42" required value={childCode} onChange={e => setChildCode(e.target.value.toUpperCase())} maxLength={10}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-primary/20 text-foreground placeholder-muted-foreground focus:border-primary outline-none text-center font-mono uppercase tracking-widest font-bold shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowMagicCode(false)} className="rounded-xl">Annulla</Button>
            <Button variant="secondary" type="submit" disabled={loading || !childCode} className="flex-1 h-11 rounded-xl font-bold">
              Entra <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
