import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, LogOut, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildProfiles, setActiveChildProfileId } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const avatarOptions = ["🧒", "👦", "👧", "🧒🏻", "👦🏽", "👧🏾", "🦸", "🧙", "🦊", "🐱", "🐻", "🌟"];

const ProfileSelector = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getChildProfiles();
      setProfiles(data);
      setLoading(false);
    };
    load();
  }, []);

  const selectProfile = (profileId: string) => {
    setActiveChildProfileId(profileId);
    // Store profile info for quick access
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      localStorage.setItem("inschool-profile", JSON.stringify({
        name: profile.name,
        age: profile.age,
        schoolLevel: profile.school_level,
        favoriteSubjects: profile.favorite_subjects,
        difficultSubjects: profile.difficult_subjects,
        struggles: profile.struggles,
        focusTime: profile.focus_time?.toString() || "15",
        supportStyle: profile.support_style,
      }));
    }
    navigate("/dashboard");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-md text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold text-foreground">Inschool</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2 mt-6">Chi studia oggi?</h1>
        <p className="text-muted-foreground mb-10">Scegli il profilo per iniziare</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {profiles.map((profile, i) => (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: i * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => selectProfile(profile.id)}
              className="flex flex-col items-center gap-3 p-6 rounded-3xl border-2 border-border bg-card hover:border-primary hover:shadow-card transition-all"
            >
              <span className="text-5xl">{profile.avatar_emoji || "🧒"}</span>
              <div>
                <p className="font-display font-bold text-foreground text-lg">{profile.name}</p>
                <p className="text-xs text-muted-foreground">{profile.age ? `${profile.age} anni` : ""}</p>
              </div>
            </motion.button>
          ))}

          {/* Add new child */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: profiles.length * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/onboarding")}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 border-dashed border-border bg-muted/30 hover:border-primary hover:bg-muted/50 transition-all min-h-[160px]"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aggiungi figlio</p>
          </motion.button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" /> Impostazioni
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSelector;
