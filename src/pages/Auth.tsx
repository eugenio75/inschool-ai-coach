import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, ArrowRight, Loader2, KeyRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { loginWithChildCode } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type LoginMode = "choose" | "parent" | "student";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<LoginMode>("choose");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childCode, setChildCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (password.length < 6) {
      toast({ title: "La password deve avere almeno 6 caratteri", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate("/profiles");
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast({
          title: "Account creato! 🎉",
          description: "Controlla la tua email per verificare l'account, poi accedi.",
        });
        setIsLogin(true);
      }
    } catch (err: any) {
      const msg = err.message?.includes("Invalid login")
        ? "Email o password non corretti"
        : err.message?.includes("already registered")
        ? "Questa email è già registrata. Prova ad accedere."
        : err.message || "Errore di autenticazione";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childCode.trim()) return;

    setLoading(true);
    try {
      await loginWithChildCode(childCode);
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: err.message || "Codice non valido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {mode === "choose" ? "Benvenuto su Inschool!" : mode === "student" ? "Ciao studente! 👋" : isLogin ? "Bentornato!" : "Crea Inschool Family"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "choose" ? "Come vuoi entrare?" : mode === "student" ? "Inserisci il tuo codice segreto" : isLogin ? "Accedi per continuare" : "Registra l'account del genitore"}
          </p>
        </div>

        {/* Mode chooser */}
        {mode === "choose" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <button
              onClick={() => setMode("student")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-card transition-all text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-clay-light flex items-center justify-center shrink-0">
                <span className="text-3xl">🎒</span>
              </div>
              <div>
                <p className="font-display font-bold text-foreground text-lg">Sono uno studente</p>
                <p className="text-sm text-muted-foreground">Entra con il tuo codice segreto</p>
              </div>
            </button>

            <button
              onClick={() => setMode("parent")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-card transition-all text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center shrink-0">
                <span className="text-3xl">👨‍👩‍👧</span>
              </div>
              <div>
                <p className="font-display font-bold text-foreground text-lg">Sono un genitore</p>
                <p className="text-sm text-muted-foreground">Accedi o registrati con email</p>
              </div>
            </button>
          </motion.div>
        )}

        {/* Student code login */}
        {mode === "student" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
            <form onSubmit={handleChildSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Il tuo codice segreto</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={childCode}
                    onChange={(e) => setChildCode(e.target.value.toUpperCase())}
                    placeholder="Es. LUNA42"
                    required
                    autoFocus
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-center text-xl font-display font-bold tracking-widest uppercase"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">Chiedi il codice al tuo genitore 😊</p>
              </div>

              <Button
                type="submit"
                disabled={loading || !childCode.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Entra!
              </Button>
            </form>
          </motion.div>
        )}

        {/* Parent email login */}
        {mode === "parent" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
            <form onSubmit={handleParentSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="genitore@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Almeno 6 caratteri"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {isLogin ? "Accedi" : "Registrati"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? (
                  <>Non hai un account? <span className="text-primary font-medium">Registrati</span></>
                ) : (
                  <>Hai già un account? <span className="text-primary font-medium">Accedi</span></>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Back button */}
        <div className="mt-8 text-center space-y-2">
          {mode !== "choose" && (
            <button
              onClick={() => setMode("choose")}
              className="text-xs text-muted-foreground hover:text-foreground block mx-auto"
            >
              ← Cambia modalità
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground block mx-auto"
          >
            ← Torna alla home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
