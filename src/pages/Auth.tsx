import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Chrome, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RoleSelector, type AuthRole } from "@/components/auth/RoleSelector";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type AuthView = "login" | "role-select" | "register";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<AuthView>("login");
  const [selectedRole, setSelectedRole] = useState<AuthRole | null>(null);

  const handleRoleSelect = (role: AuthRole) => {
    setSelectedRole(role);
    setView("register");
  };

  const handleSocialPlaceholder = (provider: string) => {
    toast({ title: `Autenticazione con ${provider} disabilitata in anteprima locale.` });
  };

  return (
    <div className="light min-h-screen bg-white text-foreground flex flex-col items-center justify-center py-10 px-4 relative overflow-hidden font-sans" data-theme="light">
      {/* Background decoration */}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: view === "login" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: view === "login" ? 10 : -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === "login" && <LoginForm />}
            {view === "role-select" && <RoleSelector onSelect={handleRoleSelect} />}
            {view === "register" && selectedRole && (
              <RegisterForm selectedRole={selectedRole} onBack={() => setView("role-select")} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Social SSO */}
        {view === "login" && (
          <div className="mt-6 space-y-3">
            <div className="relative flex items-center mb-4">
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
        )}

        {/* Toggle Login / Register */}
        <div className="mt-6 text-center text-sm border-t border-border pt-6">
          {view === "login" ? (
            <>
              <span className="text-muted-foreground">Prima volta in InSchool?</span>
              <button onClick={() => setView("role-select")} className="ml-2 font-bold transition-colors text-primary hover:text-primary/80">
                Registrati ora
              </button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Hai già un account?</span>
              <button onClick={() => setView("login")} className="ml-2 font-bold transition-colors text-primary hover:text-primary/80">
                Accedi adesso
              </button>
            </>
          )}
        </div>

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
