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

// Dynamic theme configuration per role
const roleThemes: Record<string, { bg: string, text: string, button: string, border: string }> = {
  alunno: { bg: "bg-blue-50", text: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700", border: "focus:border-blue-500" },
  superiori: { bg: "bg-purple-50", text: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700", border: "focus:border-purple-500" },
  universitario: { bg: "bg-indigo-50", text: "text-indigo-600", button: "bg-indigo-600 hover:bg-indigo-700", border: "focus:border-indigo-500" },
  docente: { bg: "bg-emerald-50", text: "text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700", border: "focus:border-emerald-500" },
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "alunno"; // alunno, superiori, universitario, docente
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const themeConfig = roleThemes[role] || roleThemes["alunno"];

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [schoolName, setSchoolName] = useState(""); // new field
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
    // Cleanup
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
        // Check if adult has a child_profile already
        if (data.user) {
          const { data: profile } = await supabase
            .from("child_profiles")
            .select("*")
            .eq("parent_id", data.user.id)
            .single();
          
          if (profile) {
            setChildSession({
                profileId: profile.id,
                accessCode: profile.access_code || "",
                profile: profile as any
            });
            // ROUTING INTELLIGENTE STEP 1
            if (["superiori", "universitario", "docente"].includes(profile.school_level)) {
                if (!(profile as any).onboarding_completed) {
                    navigate("/onboarding");
                } else {
                    navigate("/dashboard");
                }
            } else {
                navigate("/dashboard");
            }
          } else {
            // Adulto autenticato ma senza profilo su child_profiles:
            // Crea profilo base e manda a onboarding
            const adultRoles = ["superiori", "universitario", "docente"];
            // Il ruolo viene letto dal search param ?role= (già presente nell'URL al momento del login)
            const urlRole = new URLSearchParams(window.location.search).get("role") || "";
            if (adultRoles.includes(urlRole)) {
              const { data: newProfile, error: profileError } = await supabase
                .from("child_profiles")
                .insert({
                  parent_id: data.user.id,
                  name: data.user.email?.split("@")[0] || "Utente",
                  school_level: urlRole,
                  onboarding_completed: false,
                })
                .select()
                .single();
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
              // Genitore che non ha ancora creato figli
              navigate("/profiles");
            }
          }
        }
      } else {
        const { data: authData, error } = await signUp(email, password);
        if (error) throw error;
        if (authData.user) {
            // Studente superiori under 18: il genitore deve gestire la registrazione
            if (role === "superiori" && parseInt(age) < 14) {
                toast({ title: "Devi avere almeno 14 anni per registrarti come studente di superiori.", variant: "destructive" });
                setLoading(false);
                return;
            }

            // Crea self profile per gli adulti
            const { data: newProfile, error: profileError } = await supabase.from("child_profiles").insert({
                name: `${firstName} ${lastName}`,
                age: parseInt(age),
                city: locationStr,
                school_name: schoolName,
                school_level: role,
                parent_id: authData.user.id,
                onboarding_completed: false // Default
            }).select().single();

            if (profileError) throw profileError;

            // Log them in natively
            setChildSession({
                profileId: newProfile.id,
                accessCode: newProfile.access_code || "",
                profile: newProfile as any
            });
            
            toast({ title: "Account creato con successo! 🎉" });
            
            // ROUTING INTELLIGENTE STEP 1
            if (["superiori", "universitario", "docente"].includes(role)) {
                navigate("/onboarding");
            } else {
                navigate("/dashboard");
            }
        }
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
        toast({ title: "Genitore registrato! Crea subito il profilo per tuo figlio." });
        navigate("/profiles");
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center py-10 px-4 relative overflow-hidden font-sans">
      {/* Soft Light Background elements */}
      <div className="absolute top-0 w-full h-full pointer-events-none opacity-40">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-200 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] bg-purple-200 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-[440px] bg-white border border-slate-200 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10"
      >
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl ${themeConfig.bg} ${themeConfig.text} flex items-center justify-center mx-auto mb-5`}>
            {role === "alunno" && <Users className="w-8 h-8" />}
            {role === "superiori" && <BookOpen className="w-8 h-8" />}
            {role === "universitario" && <GraduationCap className="w-8 h-8" />}
            {role === "docente" && <Laptop className="w-8 h-8" />}
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
            {getRoleTitle()}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
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
                // Parent / Alunno Flow
                <div className="space-y-6">
                    <form onSubmit={handleParentSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email Genitore</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                    className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 ${themeConfig.border} outline-none transition-colors`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                    className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 ${themeConfig.border} outline-none transition-colors`}
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={loading} className={`w-full h-12 rounded-xl text-white font-bold shadow-sm ${themeConfig.button}`}>
                            {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : (isLogin ? "Accedi" : "Registrati")}
                        </Button>
                    </form>

                    <div className="h-[1px] bg-slate-200 w-full relative my-8">
                        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-4 text-xs font-bold text-slate-400 tracking-wider">OPPURE</span>
                    </div>

                    <form onSubmit={handleChildCodeSubmit} className="space-y-4 bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                        <label className="text-sm font-bold text-blue-900 block text-center">App Studente: Codice Magico</label>
                        <p className="text-xs text-blue-600 text-center mb-2">Utilizza il codice generato dall'app genitore</p>
                        <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                            <input
                                placeholder="ES. LUNA42" required value={childCode} onChange={e => setChildCode(e.target.value.toUpperCase())} maxLength={10}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-blue-200 text-blue-900 placeholder-blue-300 focus:border-blue-500 outline-none text-center font-mono uppercase tracking-widest font-bold shadow-sm"
                            />
                        </div>
                        <Button variant="secondary" type="submit" disabled={loading || !childCode} className="w-full h-11 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold">
                            Entra Studente <ArrowRight className="ml-2 w-4 h-4"/>
                        </Button>
                    </form>
                </div>
            ) : (
                // Adult Flow
                <form onSubmit={handleAdultSubmit} className="space-y-4">
                    {!isLogin && (
                        <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input required value={firstName} onChange={e => setFirstName(e.target.value)}
                                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm text-slate-900 ${themeConfig.border} transition-colors`} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cognome</label>
                                <input required value={lastName} onChange={e => setLastName(e.target.value)}
                                    className={`w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm text-slate-900 ${themeConfig.border} transition-colors`} />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nome Istituto / Università</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input required value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Es. Liceo Da Vinci / La Sapienza"
                                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm text-slate-900 ${themeConfig.border} transition-colors`} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Età</label>
                                <input required type="number" min="14" max="99" value={age} onChange={e => setAge(e.target.value)} placeholder="Anni"
                                    className={`w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm text-center text-slate-900 ${themeConfig.border} transition-colors`} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Città</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        ref={locationInputRef}
                                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm text-slate-900 placeholder-slate-400 ${themeConfig.border} transition-colors`}
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
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none ${themeConfig.border} transition-colors`} />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={6}
                                className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none ${themeConfig.border} transition-colors`} />
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className={`w-full h-12 rounded-xl text-white font-bold shadow-sm mt-4 transition-all ${themeConfig.button}`}>
                        {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : (isLogin ? "Accedi all'Account" : "Termina Iscrizione")}
                    </Button>
                </form>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Social SSO Placeholders */}
        <div className="mt-8 space-y-3">
             <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Oppure rapido</span>
                <div className="flex-grow border-t border-slate-200"></div>
            </div>
            <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => handleSocialPlaceholder("Google")} className="w-full h-11 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl shadow-sm">
                    <Chrome className="w-4 h-4 mr-2 text-rose-500" /> Google
                </Button>
                <Button type="button" variant="outline" onClick={() => handleSocialPlaceholder("Azar Group")} className="w-full h-11 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl shadow-sm">
                    <Globe className="w-4 h-4 mr-2 text-indigo-500" /> Azar Client
                </Button>
            </div>
        </div>

        {/* Forgot password + Toggle Login/Signup */}
        {isLogin && !isMinorRole && (
          <ForgotPasswordInline />
        )}
        <div className="mt-6 text-center text-sm border-t border-slate-100 pt-6">
            <span className="text-slate-500">{isLogin ? "Prima volta in InSchool?" : "Hai già un account?"}</span>
            <button
                onClick={() => setIsLogin(!isLogin)}
                className={`ml-2 font-bold transition-colors ${themeConfig.text}`}
            >
                {isLogin ? "Registrati ora" : "Accedi adesso"}
            </button>
        </div>

        {/* Go back */}
        <button
            onClick={() => navigate("/")}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600 block mx-auto transition-colors font-medium"
        >
            ← Torna alla Home
        </button>
      </motion.div>
    </div>
  );
};

export default Auth;
