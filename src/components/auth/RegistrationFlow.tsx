import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepDob } from "./steps/StepDob";
import { StepUnderAge } from "./steps/StepUnderAge";
import { StepRoleSelect } from "./steps/StepRoleSelect";
import { StepCredentials } from "./steps/StepCredentials";

export type RegistrationRole = "studente" | "docente" | "genitore";

interface RegistrationFlowProps {
  onSwitchToLogin: () => void;
}

const slideVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export function RegistrationFlow({ onSwitchToLogin }: RegistrationFlowProps) {
  const [step, setStep] = useState<"dob" | "underage" | "role" | "credentials">("dob");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);

  const handleDobContinue = (dobValue: string, ageValue: number) => {
    setDob(dobValue);
    setAge(ageValue);
    if (ageValue < 14) {
      setStep("underage");
    } else {
      setStep("role");
    }
  };

  const handleRoleSelect = (role: RegistrationRole) => {
    // Age validation per role
    if (role === "docente" && age !== null && age < 18) {
      return "Per registrarsi come Docente devi avere almeno 18 anni.";
    }
    if (role === "genitore" && age !== null && age < 18) {
      return "Per gestire profili di minori devi avere almeno 18 anni ai sensi dell'art. 8 GDPR.";
    }
    if (role === "studente" && age !== null && age < 14) {
      return "Per registrarsi come Studente devi avere almeno 14 anni.";
    }
    setSelectedRole(role);
    setStep("credentials");
    return null;
  };

  const handleParentFromUnderage = () => {
    setSelectedRole("genitore");
    // Override age requirement — parent flow from underage sets the parent as the registering adult
    // But actually the person is < 14, so they can't register as parent either
    // The button should redirect to login as "switch to login" for the parent
    onSwitchToLogin();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {step === "dob" && (
            <StepDob
              onContinue={handleDobContinue}
              onSwitchToLogin={onSwitchToLogin}
            />
          )}
          {step === "underage" && (
            <StepUnderAge
              onParentRegister={handleParentFromUnderage}
              onMagicCode={onSwitchToLogin}
              onBack={() => setStep("dob")}
            />
          )}
          {step === "role" && (
            <StepRoleSelect
              age={age!}
              onSelect={handleRoleSelect}
              onBack={() => setStep("dob")}
              onSwitchToLogin={onSwitchToLogin}
            />
          )}
          {step === "credentials" && selectedRole && (
            <StepCredentials
              role={selectedRole}
              dob={dob}
              age={age!}
              onBack={() => setStep("role")}
              onSwitchToLogin={onSwitchToLogin}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
