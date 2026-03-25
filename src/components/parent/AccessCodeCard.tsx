import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Copy, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateChildProfile } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface AccessCodeCardProps {
  profile: any;
  onProfileUpdate: (id: string, updates: any) => void;
}

export const AccessCodeCard = ({ profile, onProfileUpdate }: AccessCodeCardProps) => {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (profile.access_code) {
      navigator.clipboard.writeText(profile.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data: newCode } = await supabase.rpc("generate_child_access_code");
      if (newCode) {
        await updateChildProfile(profile.id, { access_code: newCode });
        onProfileUpdate(profile.id, { access_code: newCode });
        toast({ title: `Nuovo codice generato: ${newCode}` });
      }
    } catch {
      toast({ title: "Errore nella rigenerazione", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.2 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Codice accesso</h3>
          <p className="text-[11px] text-muted-foreground">Per far entrare {profile.name} nella sua area</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-center">
          <span className="font-display text-xl font-bold tracking-widest text-foreground">
            {profile.access_code || "—"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${regenerating ? "animate-spin" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
};
