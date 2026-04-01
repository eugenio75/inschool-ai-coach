import { useState } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check } from "lucide-react";
import { useLang } from "@/contexts/LangContext";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface AccessCodeCardProps {
  code: string;
}

export function AccessCodeCard({ code }: AccessCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useLang();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-foreground text-sm">
          {t("profile_access_code_title")}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t("profile_access_code_desc")}
      </p>
      <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
        <span className="font-mono text-lg font-bold text-foreground tracking-widest flex-1">
          {code}
        </span>
        <button
          onClick={handleCopy}
          className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  );
}
