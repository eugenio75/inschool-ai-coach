import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, LogOut, BookOpen, Loader2, Users, GraduationCap, ChevronRight, UserCog, Copy, Check, ArrowLeft } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildProfiles, setActiveChildProfileId } from "@/lib/database";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { getChildSession, setChildSession } from "@/lib/childSession";
import { toast } from "sonner";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const ProfileSelector = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { signOut } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = (code: string, profileId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(profileId);
    toast.success("Copiato!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const load = async () => {
      const session = getChildSession();
      const role = session?.profile?.school_level;
      if (["superiori", "universitario", "docente"].includes(role || "")) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const data = await getChildProfiles();
      setProfiles(data);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const selectProfile = (profileId: string) => {
    setActiveChildProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      if (["superiori", "universitario", "docente"].includes(profile.school_level || "")) {
        setChildSession({
          profileId: profile.id,
          accessCode: profile.access_code || "",
          profile,
        });
      }
      localStorage.setItem("inschool-profile", JSON.stringify({
        id: profile.id,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        avatarEmoji: profile.avatar_emoji,
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isDocente = profiles.some(p => p.school_level === "docente");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative font-sans overflow-hidden">
      <button
        onClick={() => navigate(profiles.length > 0 ? "/dashboard" : "/")}
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-foreground shadow-soft backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{(() => { try { return useLang().t("back_button"); } catch { return "Indietro"; } })()}</span>
      </button>
      {/* Sfondo geometrico minimale */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-5xl flex flex-col items-center"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">InSchool Hub</span>
        </div>

        <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
               {isDocente ? "Hub Operativo" : "Selezione Profilo"}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
               {isDocente ? "Accedi al tuo cruscotto docente o seleziona una classe da gestire." : "Seleziona l'account per accedere allo spazio di studio."}
            </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full mb-12 max-w-4xl">
          <AnimatePresence>
          {profiles.map((profile, i) => (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => selectProfile(profile.id)}
              className="group flex flex-col p-6 rounded-[2rem] border border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left relative overflow-hidden h-full min-h-[220px]"
            >
              <div className="absolute top-5 right-5 text-muted-foreground group-hover:text-primary transition-colors">
                  <ChevronRight className="w-5 h-5" />
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                  {profile.school_level === "docente" 
                    ? <UserCog className="w-7 h-7 text-primary" /> 
                    : <AvatarInitials name={profile.name || "U"} size="md" />}
              </div>
              <div className="mt-auto">
                <p className="font-bold text-foreground text-xl mb-1 truncate pr-6">{profile.name}</p>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {profile.school_level === "docente" ? <><BookOpen className="w-4 h-4 shrink-0"/> Area Docente</> : <><GraduationCap className="w-4 h-4 shrink-0"/> {profile.school_level === "classe" ? "Nuova Classe" : "Studente"} {profile.age ? `· ${profile.age} anni` : ""}</>}
                </p>
                {profile.access_code && profile.school_level !== "docente" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyCode(profile.access_code, profile.id); }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <span className="font-mono font-semibold tracking-wider">{profile.access_code}</span>
                    {copiedId === profile.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </motion.button>
          ))}
          </AnimatePresence>

          {/* Add Profile/Class Action */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...spring, delay: profiles.length * 0.05 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/onboarding")}
            className="group flex flex-col p-6 rounded-[2rem] border-2 border-dashed border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/30 transition-all text-left min-h-[220px] justify-center items-center"
          >
            <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors shadow-sm">
              <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="font-bold text-foreground group-hover:text-primary transition-colors text-center w-full">
                {isDocente ? "Aggiungi Classe" : "Aggiungi Profilo"}
            </p>
            <p className="text-xs text-muted-foreground text-center mt-2 px-1">
                {isDocente ? "Crea lo spazio per la tua classe" : "Registra un nuovo studente"}
            </p>
          </motion.button>
        </div>

        {/* Global Controls */}
        <div className="flex items-center justify-center gap-6 flex-wrap bg-card px-8 py-4 rounded-[2rem] border border-border shadow-sm">
          {!isDocente && (
              <button
                onClick={() => navigate("/parent-dashboard")}
                className="flex items-center gap-2 font-semibold text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Users className="w-4 h-4" /> Area Genitori
              </button>
          )}
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 font-semibold text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings className="w-4 h-4" /> Impostazioni 
          </button>
          <div className="w-px h-4 bg-border hidden md:block"></div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 font-semibold text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" /> Disconnetti
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSelector;
