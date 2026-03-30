import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepDob } from "./steps/StepDob";
import { StepUnderAge } from "./steps/StepUnderAge";
import { StepRoleSelect } from "./steps/StepRoleSelect";
import { StepCredentials } from "./steps/StepCredentials";
import { StepTeacherDeclaration } from "./steps/StepTeacherDeclaration";
import type { TeacherDeclaration } from "./steps/StepTeacherDeclaration";

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
  const [step, setStep] = useState<"dob" | "underage" | "role" | "teacher_declaration" | "credentials">("dob");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);
  const [teacherDeclaration, setTeacherDeclaration] = useState<TeacherDeclaration | null>(null);

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
    setSelectedRole(role);
    if (role === "docente") {
      setStep("teacher_declaration");
    } else {
      setStep("credentials");
    }
  };

  const handleTeacherDeclarationComplete = (declaration: TeacherDeclaration) => {
    setTeacherDeclaration(declaration);
    // Store for later persistence
    localStorage.setItem("inschool-teacher-declaration", JSON.stringify(declaration));
    setStep("credentials");
  };

  const handleParentFromUnderage = () => {
    setSelectedRole("genitore");
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
          {step === "teacher_declaration" && (
            <StepTeacherDeclaration
              onComplete={handleTeacherDeclarationComplete}
              onBack={() => setStep("role")}
            />
          )}
          {step === "credentials" && selectedRole && (
            <StepCredentials
              role={selectedRole}
              dob={dob}
              age={age!}
              onBack={() => selectedRole === "docente" ? setStep("teacher_declaration") : setStep("role")}
              onSwitchToLogin={onSwitchToLogin}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
