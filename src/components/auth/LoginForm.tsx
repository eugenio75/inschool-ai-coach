import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { loginWithChildCode } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { setChildSession } from "@/lib/childSession";
import { LegalDisclaimer } from "./LegalDisclaimer";

const ADULT_ROLES = ["superiori", "universitario", "docente"];

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
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

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 text-sm";

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Bentornato su InSchool
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Accedi al tuo account</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
        </div>
        <div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="Password"
            className={inputClass}
          />
          <Link
            to="/forgot-password"
            className="block text-xs text-muted-foreground hover:text-primary transition-colors mt-2 font-medium"
          >
            Password dimenticata?
          </Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold">
          {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Accedi"}
        </Button>
      </form>

      {/* Magic Code */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            oppure
          </span>
        </div>
      </div>

      {!showMagicCode ? (
        <button
          onClick={() => setShowMagicCode(true)}
          className="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Accedi con Codice Magico
        </button>
      ) : (
        <form onSubmit={handleChildCode} className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
          <p className="text-xs text-muted-foreground text-center mb-2">
            Inserisci il codice ricevuto dal tuo genitore
          </p>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="ES. LUNA42"
              required
              value={childCode}
              onChange={(e) => setChildCode(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-border text-foreground text-center font-mono uppercase tracking-widest font-bold outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMagicCode(false)}
              className="rounded-xl"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={loading || !childCode}
              className="flex-1 h-10 rounded-xl font-bold"
            >
              Entra <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </form>
      )}

      {/* Switch to register */}
      <div className="mt-6 text-center">
        <span className="text-sm text-muted-foreground">Non hai un account?</span>
        <button
          onClick={onSwitchToRegister}
          className="ml-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
        >
          Registrati →
        </button>
      </div>

      <LegalDisclaimer />
    </div>
  );
}
