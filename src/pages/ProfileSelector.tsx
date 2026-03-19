import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, LogOut, BookOpen, Loader2, Users, GraduationCap, ChevronRight, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildProfiles, setActiveChildProfileId } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

// Avatar con iniziali — colore deterministico basato sul nome
function AvatarInitials({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-teal-100 text-teal-700",
  ];
  const colorClass = colors[name.charCodeAt(0) % colors.length];
  const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-12 h-12 text-sm", lg: "w-14 h-14 text-base" }[size];
  return (
    <div className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${sizeClass} ${colorClass}`}>
      {initials}
    </div>
  );
}

const ProfileSelector = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getChildProfiles();
      if (data.length > 0) {
        const role = data[0].school_level;
        // Solo liceali e universitari vengono cacciati. I docenti possono gestire le classi dal profile selector.
        if (["superiori", "universitario", "docente"].includes(role)) {
          navigate("/dashboard", { replace: true });
          return;
        }
      }
      setProfiles(data);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const selectProfile = (profileId: string) => {
    setActiveChildProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isDocente = profiles.some(p => p.school_level === "docente");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 relative font-sans overflow-hidden">
      {/* Sfondo geometrico minimale 2026 */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/50 to-transparent -z-10" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl -z-10" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-5xl flex flex-col items-center"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <span className="font-display text-2xl font-bold text-slate-900 tracking-tight">InSchool Hub</span>
        </div>

        <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
               {isDocente ? "Hub Operativo" : "Selezione Profilo"}
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
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
              className="group flex flex-col p-6 rounded-[2rem] border border-slate-200 bg-white hover:border-blue-500 hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.15)] transition-all text-left relative overflow-hidden h-full min-h-[220px]"
            >
              <div className="absolute top-5 right-5 text-slate-300 group-hover:text-blue-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                  {profile.school_level === "docente" 
                    ? <UserCog className="w-7 h-7 text-blue-600" /> 
                    : <AvatarInitials name={profile.name || "U"} size="md" />}
              </div>
              <div className="mt-auto">
                <p className="font-bold text-slate-900 text-xl mb-1 truncate pr-6">{profile.name}</p>
                <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {profile.school_level === "docente" ? <><BookOpen className="w-4 h-4 shrink-0"/> Area Docente</> : <><GraduationCap className="w-4 h-4 shrink-0"/> {profile.school_level === "classe" ? "Nuova Classe" : "Studente"} {profile.age ? `· ${profile.age} anni` : ""}</>}
                </p>
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
            className="group flex flex-col p-6 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-300 transition-all text-left min-h-[220px] justify-center items-center"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4 group-hover:bg-blue-100 group-hover:border-blue-200 transition-colors shadow-sm">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors text-center w-full">
                {isDocente ? "Aggiungi Classe" : "Aggiungi Profilo"}
            </p>
            <p className="text-xs text-slate-400 text-center mt-2 px-1">
                {isDocente ? "Crea lo spazio per la tua classe" : "Registra un nuovo studente"}
            </p>
          </motion.button>
        </div>

        {/* Global Controls */}
        <div className="flex items-center justify-center gap-6 flex-wrap bg-white px-8 py-4 rounded-[2rem] border border-slate-200 shadow-sm">
          {!isDocente && (
              <button
                onClick={() => navigate("/parent-dashboard")}
                className="flex items-center gap-2 font-semibold text-sm text-slate-500 hover:text-blue-600 transition-colors"
              >
                <Users className="w-4 h-4" /> Area Genitori
              </button>
          )}
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 font-semibold text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Settings className="w-4 h-4" /> Impostazioni 
          </button>
          <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 font-semibold text-sm text-slate-500 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Disconnetti
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSelector;
