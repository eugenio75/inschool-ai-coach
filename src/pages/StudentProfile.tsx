import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, X, Plus, Loader2, School, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession, getChildSession, setChildSession } from "@/lib/childSession";
import { getActiveChildProfileId, getChildProfile, updateChildProfile } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

const AVATAR_EMOJIS = ["🧒", "👦", "👧", "🦸", "🧑‍🎓", "🦊", "🐼", "🦁", "🐯", "🐸", "🦄", "🐲", "🌟", "🚀", "🎨", "⚽", "🎸", "🦋", "🐬", "🦉"];

const INTEREST_SUGGESTIONS = [
  "Calcio", "Basket", "Nuoto", "Danza", "Musica", "Chitarra", "Pianoforte",
  "Videogiochi", "Minecraft", "Roblox", "Disegno", "Fumetti", "Manga",
  "Dinosauri", "Spazio", "Animali", "Cucina", "Lego", "Harry Potter",
  "Scienza", "Robot", "YouTube", "Film", "Serie TV", "Skateboard",
];

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isChild = isChildSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [gender, setGender] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [classSection, setClassSection] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const load = async () => {
      let p = null;
      if (isChild) {
        const session = getChildSession();
        if (session) p = session.profile;
      } else {
        const profileId = getActiveChildProfileId();
        if (profileId) p = await getChildProfile(profileId);
      }
      if (p) {
        setProfile(p);
        setSelectedAvatar(p.avatar_emoji || "🧒");
        setGender((p as any).gender || "");
        setInterests(p.interests || []);
        setClassSection(p.class_section || "");
        setSchoolName(p.school_name || "");
        setCity(p.city || "");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates = {
        avatar_emoji: selectedAvatar,
        interests,
        class_section: classSection.trim() || null,
        school_name: schoolName.trim() || null,
        city: city.trim() || null,
      };
      if (isChild) {
        const { childApi } = await import("@/lib/childSession");
        await childApi("update-profile", updates);
        const session = getChildSession();
        if (session) {
          const updatedProfile = { ...session.profile, ...updates };
          setChildSession({ ...session, profile: updatedProfile });
        }
      } else {
        await updateChildProfile(profile.id, updates);
      }
      toast({ title: "Profilo aggiornato! ✨" });
      navigate(-1);
    } catch (e) {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addInterest = (interest: string) => {
    const trimmed = interest.trim();
    if (trimmed && !interests.includes(trimmed) && interests.length < 10) {
      setInterests([...interests, trimmed]);
    }
    setCustomInterest("");
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!profile) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Profilo non trovato</p></div>;

  const hasChanges = selectedAvatar !== (profile.avatar_emoji || "🧒") 
    || JSON.stringify(interests) !== JSON.stringify(profile.interests || [])
    || classSection !== (profile.class_section || "")
    || schoolName !== (profile.school_name || "")
    || city !== (profile.city || "");

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Il mio profilo</span>
          </div>

          {/* Avatar display */}
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="text-center">
            <div className="text-6xl mb-2">{selectedAvatar}</div>
            <h2 className="font-display text-xl font-bold text-foreground">{profile.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {[profile.age ? `${profile.age} anni` : "", classSection, schoolName, city].filter(Boolean).join(" • ") || profile.school_level || ""}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Avatar picker */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4 text-sm">Scegli la tua icona</h3>
            <div className="grid grid-cols-5 gap-3">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`text-3xl p-2 rounded-xl transition-all ${selectedAvatar === emoji ? "bg-primary/15 ring-2 ring-primary scale-110" : "hover:bg-accent"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>

          {/* School info */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <School className="w-4 h-4 text-sage-dark" />
              <h3 className="font-display font-semibold text-foreground text-sm">La mia scuola</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Queste info aiutano il coach a conoscerti meglio (facoltativo)</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Classe (es. 3ª B)</label>
                <input
                  type="text"
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value.slice(0, 20))}
                  placeholder="Es. 3ª B"
                  maxLength={20}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome della scuola</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value.slice(0, 100))}
                  placeholder="Es. IC Alessandro Manzoni"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Città</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value.slice(0, 50))}
                  placeholder="Es. Roma"
                  maxLength={50}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </motion.div>

          {/* Interests */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-foreground text-sm">I tuoi interessi</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Il tuo coach userà i tuoi interessi per rendere lo studio più divertente! (facoltativo)</p>

            {/* Current interests */}
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {interests.map((interest) => (
                  <span key={interest} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {interest}
                    <button onClick={() => removeInterest(interest)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Custom input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && customInterest.trim() && addInterest(customInterest)}
                placeholder="Aggiungi un interesse..."
                maxLength={30}
                className="flex-1 px-4 py-2 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addInterest(customInterest)}
                disabled={!customInterest.trim() || interests.length >= 10}
                className="rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggestions toggle */}
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs text-primary font-medium hover:underline mb-3"
            >
              {showSuggestions ? "Nascondi suggerimenti" : "💡 Suggerimenti"}
            </button>

            {showSuggestions && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-1.5">
                {INTEREST_SUGGESTIONS.filter(s => !interests.includes(s)).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => addInterest(suggestion)}
                    disabled={interests.length >= 10}
                    className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30"
                  >
                    + {suggestion}
                  </button>
                ))}
              </motion.div>
            )}

            {interests.length >= 10 && (
              <p className="text-xs text-muted-foreground mt-2">Massimo 10 interessi</p>
            )}
          </motion.div>

          {/* Save */}
          {hasChanges && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button onClick={handleSave} disabled={saving} className="w-full rounded-2xl bg-primary text-primary-foreground py-6 text-base font-medium">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salva modifiche
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
