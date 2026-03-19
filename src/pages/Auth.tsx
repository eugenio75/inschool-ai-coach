import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Mail, Lock, KeyRound, MapPin, User, ArrowRight, Loader2, Hexagon, Building2, Chrome, Globe, Users, BookOpen, GraduationCap, Laptop, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { loginWithChildCode, setChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

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
      redirectTo: window.location.origin + "/reset-password",
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
        <p className="text-xs text-muted-foreground mt-1">Controlla la tua casella di posta e segui le istruzioni per reimpostare la password.</p>
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
      <p className="text-xs text-muted-foreground">Ti invieremo un link per reimpostare la password.</p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShow(false)} className="text-muted-foreground rounded-xl">Annulla</Button>
        <Button type="submit" size="sm" disabled={loading || !email.trim()} className="rounded-xl flex-1">
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "Invia link di reset"}
        </Button>
      </div>
    </form>
  );
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "alunno";
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [locationStr, setLocationStr] = useState("");
  const [childCode, setChildCode] = useState("");
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let autocomplete: any = null;
    if (locationInputRef.current && (window as any).google) {
      autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, {
        types: ["(cities)"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete?.getPlace();
        if (place?.formatted_address) {
          setLocationStr(place.formatted_address);
        }
      });
    }
    return () => {
      if (autocomplete) {
        (window as any).google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [role, isLogin]);

  const isMinorRole = role === "alunno";

  const getRoleTitle = () => {
    if (role === "alunno") return isLogin ? "Bentornato Genitore" : "Registrazione Genitore";
    if (role === "superiori") return isLogin ? "Bentornato Studente" : "Registrazione Superiori";
    if (role === "universitario") return isLogin ? "Accesso Universitario" : "Registrazione Universitario";
    if (role === "docente") return isLogin ? "Bentornato Docente" : "Registrazione Docente";
    return "";
  };

  const getRoleIcon = () => {
    if (role === "alunno") return <Users className="w-8 h-8" />;
    if (role === "superiori") return <BookOpen className="w-8 h-8" />;
    if (role === "universitario") return <GraduationCap className="w-8 h-8" />;
    if (role === "docente") return <Laptop className="w-8 h-8" />;
    return null;
  };

  const handleAdultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (!isLogin && (!firstName || !lastName || !age || !locationStr || !schoolName)) {
        toast({ title: "Compila tutti i campi richiesti", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        if (data.user) {
          // Fetch all profiles for this user
          const { data: profiles } = await supabase
            .from("child_profiles")
            .select("*")
            .eq("parent_id", data.user.id);

          const adultRoles = ["superiori", "universitario", "docente"];
          const adultProfile = profiles?.find(p => adultRoles.includes(p.school_level || ""));

          if (adultProfile) {
            setChildSession({
              profileId: adultProfile.id,
              accessCode: adultProfile.access_code || "",
              profile: adultProfile as any,
            });
            if (!adultProfile.onboarding_completed) {
              navigate("/onboarding");
            } else {
              navigate("/dashboard");
            }
          } else if (profiles && profiles.length > 0) {
            // Has child profiles (parent account)
            navigate("/profiles");
          } else {
            // No profiles at all — check for stored signup metadata or URL role
            const adultRoles2 = ["superiori", "universitario", "docente"];
            const urlRole = new URLSearchParams(window.location.search).get("role") || "";
            const storedMeta = localStorage.getItem("inschool-signup-meta");
            let meta: any = null;
            try { meta = storedMeta ? JSON.parse(storedMeta) : null; } catch {}

            const targetRole = meta?.school_level || (adultRoles2.includes(urlRole) ? urlRole : "");

            if (targetRole && adultRoles2.includes(targetRole)) {
              const { data: newProfile, error: profileError } = await supabase
                .from("child_profiles")
                .insert({
                  parent_id: data.user.id,
                  name: meta?.name || data.user.email?.split("@")[0] || "Utente",
                  school_level: targetRole,
                  age: meta?.age || null,
                  city: meta?.city || null,
                  school_name: meta?.school_name || null,
                  onboarding_completed: false,
                })
                .select()
                .single();

              localStorage.removeItem("inschool-signup-meta");

              if (profileError || !newProfile) {
                toast({ title: "Errore nella creazione del profilo. Riprova.", variant: "destructive" });
                setLoading(false);
                return;
              }
              setChildSession({
                profileId: newProfile.id,
                accessCode: newProfile.access_code || "",
                profile: newProfile as any,
              });
              navigate("/onboarding");
            } else {
              localStorage.removeItem("inschool-signup-meta");
              navigate("/profiles");
            }
          }
        }
      } else {
        // SIGNUP — just create the auth account, redirect to verify-email.
        // The child_profile will be created on first login (after email verification).
        if (role === "superiori" && parseInt(age) < 14) {
          toast({ title: "Devi avere almeno 14 anni per registrarti come studente di superiori.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password);
        if (error) throw error;

        // Store signup metadata in localStorage so we can create the profile on first login
        localStorage.setItem("inschool-signup-meta", JSON.stringify({
          name: `${firstName} ${lastName}`,
          age: parseInt(age),
          city: locationStr,
          school_name: schoolName,
          school_level: role,
        }));

        toast({ title: "Account creato! Controlla la tua email per confermare la registrazione." });
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate("/profiles");
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      toast({ title: err.message || "Errore", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChildCodeSubmit = async (e: React.FormEvent) => {
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

  const handleSocialPlaceholder = (provider: string) => {
    toast({ title: `Autenticazione con ${provider} disabilitata in anteprima locale.` });
  };

  const inputClass = "w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors";
  const inputSmClass = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors";
  const labelClass = "text-sm font-semibold text-foreground block mb-1.5";
  const labelSmClass = "text-xs font-semibold text-muted-foreground mb-1.5 block";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center py-10 px-4 relative overflow-hidden font-sans">
      {/* Soft Light Background elements */}
      <div className="absolute top-0 w-full h-full pointer-events-none opacity-40">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] bg-accent/20 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-[440px] bg-card border border-border p-8 rounded-[2rem] shadow-soft relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5">
            {getRoleIcon()}
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            {getRoleTitle()}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isLogin ? "Inserisci le tue credenziali per accedere" : "Crea il tuo profilo accademico in pochi secondi"}
          </p>
        </div>

        {/* Form container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? "login" : "register"}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {isMinorRole ? (
                <div className="space-y-6">
                    <form onSubmit={handleParentSubmit} className="space-y-4">
                        <div>
                            <label className={labelClass}>Email Genitore</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold shadow-sm">
                            {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : (isLogin ? "Accedi" : "Registrati")}
                        </Button>
                    </form>

                    <div className="h-[1px] bg-border w-full relative my-8">
                        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-4 text-xs font-bold text-muted-foreground tracking-wider">OPPURE</span>
                    </div>

                    <form onSubmit={handleChildCodeSubmit} className="space-y-4 bg-primary/5 p-5 rounded-2xl border border-primary/20">
                        <label className="text-sm font-bold text-foreground block text-center">App Studente: Codice Magico</label>
                        <p className="text-xs text-primary text-center mb-2">Utilizza il codice generato dall'app genitore</p>
                        <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                            <input
                                placeholder="ES. LUNA42" required value={childCode} onChange={e => setChildCode(e.target.value.toUpperCase())} maxLength={10}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-primary/20 text-foreground placeholder-muted-foreground focus:border-primary outline-none text-center font-mono uppercase tracking-widest font-bold shadow-sm"
                            />
                        </div>
                        <Button variant="secondary" type="submit" disabled={loading || !childCode} className="w-full h-11 rounded-xl font-bold">
                            Entra Studente <ArrowRight className="ml-2 w-4 h-4"/>
                        </Button>
                    </form>
                </div>
            ) : (
                <form onSubmit={handleAdultSubmit} className="space-y-4">
                    {!isLogin && (
                        <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelSmClass}>Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input required value={firstName} onChange={e => setFirstName(e.target.value)} className={inputSmClass} />
                                </div>
                            </div>
                            <div>
                                <label className={labelSmClass}>Cognome</label>
                                <input required value={lastName} onChange={e => setLastName(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground focus:border-primary transition-colors" />
                            </div>
                        </div>

                        <div>
                            <label className={labelSmClass}>Nome Istituto / Università</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input required value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Es. Liceo Da Vinci / La Sapienza"
                                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground placeholder-muted-foreground focus:border-primary transition-colors" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <label className={labelSmClass}>Età</label>
                                <input required type="number" min="14" max="99" value={age} onChange={e => setAge(e.target.value)} placeholder="Anni"
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-center text-foreground placeholder-muted-foreground focus:border-primary transition-colors" />
                            </div>
                            <div className="col-span-2">
                                <label className={labelSmClass}>Città</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        ref={locationInputRef}
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border outline-none text-sm text-foreground placeholder-muted-foreground focus:border-primary transition-colors"
                                        placeholder="Ricerca..."
                                        required
                                        type="text"
                                        onChange={(e) => setLocationStr(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        </>
                    )}

                    <div>
                        <label className={labelClass}>Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={6} className={inputClass} />
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold shadow-sm mt-4 transition-all">
                        {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : (isLogin ? "Accedi all'Account" : "Termina Iscrizione")}
                    </Button>
                </form>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Social SSO Placeholders */}
        <div className="mt-8 space-y-3">
             <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Oppure rapido</span>
                <div className="flex-grow border-t border-border"></div>
            </div>
            <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => handleSocialPlaceholder("Google")} className="w-full h-11 font-medium rounded-xl shadow-sm">
                    <Chrome className="w-4 h-4 mr-2" /> Google
                </Button>
                <Button type="button" variant="outline" onClick={() => handleSocialPlaceholder("Azar Group")} className="w-full h-11 font-medium rounded-xl shadow-sm">
                    <Globe className="w-4 h-4 mr-2" /> Azar Client
                </Button>
            </div>
        </div>

        {/* Forgot password + Toggle Login/Signup */}
        {isLogin && !isMinorRole && (
          <ForgotPasswordInline />
        )}
        <div className="mt-6 text-center text-sm border-t border-border pt-6">
            <span className="text-muted-foreground">{isLogin ? "Prima volta in InSchool?" : "Hai già un account?"}</span>
            <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 font-bold transition-colors text-primary hover:text-primary/80"
            >
                {isLogin ? "Registrati ora" : "Accedi adesso"}
            </button>
        </div>

        {/* Go back */}
        <button
            onClick={() => navigate("/")}
            className="mt-6 text-xs text-muted-foreground hover:text-foreground block mx-auto transition-colors font-medium"
        >
            ← Torna alla Home
        </button>
      </motion.div>
    </div>
  );
};

export default Auth;
