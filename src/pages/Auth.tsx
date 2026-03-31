import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/shared/FloatingBackButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegistrationFlow } from "@/components/auth/RegistrationFlow";

type AuthView = "login" | "register";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");

  return (
    <div
      className="light min-h-screen bg-background text-foreground flex flex-col items-center justify-center py-10 px-4 font-sans"
      data-theme="light"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-[460px] relative z-10"
      >
        <AnimatePresence mode="wait">
          {view === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <LoginForm onSwitchToRegister={() => setView("register")} />
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <RegistrationFlow onSwitchToLogin={() => setView("login")} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
