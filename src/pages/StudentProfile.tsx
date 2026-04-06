import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, X, Plus, Loader2, User, GraduationCap, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession, getChildSession, setChildSession } from "@/lib/childSession";
import { getActiveChildProfileId, getChildProfile, updateChildProfile } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { useLang } from "@/contexts/LangContext";
import UniversityStudyPlan, { type StudyPlanExam } from "@/components/UniversityStudyPlan";
import { loadStudyPlan, saveStudyPlan } from "@/lib/studyPlanService";
import { AccessCodeCard } from "@/components/profile/AccessCodeCard";
import { EditableSchoolCard } from "@/components/profile/EditableSchoolCard";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClass } from "@/lib/normalizeClass";

const INTEREST_SUGGESTIONS = [
  "Calcio", "Basket", "Nuoto", "Danza", "Musica", "Chitarra", "Pianoforte",
  "Videogiochi", "Minecraft", "Roblox", "Disegno", "Fumetti", "Manga",
  "Dinosauri", "Spazio", "Animali", "Cucina", "Lego", "Harry Potter",
  "Scienza", "Robot", "YouTube", "Film", "Serie TV", "Skateboard",
];

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const CHILD_LEVELS = [
  "primaria", "primaria-1", "primaria-2", "primaria-3", "primaria-4", "primaria-5",
  "primaria-1-2", "primaria-3-5",
  "medie", "media-1", "media-2", "media-3",
];

function isChildLevel(level?: string | null): boolean {
  return !!level && CHILD_LEVELS.includes(level);
}

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isChild = isChildSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gender, setGender] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [schoolData, setSchoolData] = useState({ city: "", schoolName: "", schoolCode: null as string | null, classSection: "" });
  const [customInterest, setCustomInterest] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [studyPlan, setStudyPlan] = useState<StudyPlanExam[]>([]);
  const [coachName, setCoachName] = useState("");
  const [originalCoachName, setOriginalCoachName] = useState("");
  const { t } = useLang();

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
        setGender((p as any).gender || "");
        setInterests(p.interests || []);

        // Load school data - for child profiles read directly, for others check user_preferences too
        let city = p.city || "";
        let schoolName = p.school_name || "";
        let schoolCode = p.school_code || null;
        let classSection = p.class_section || "";

        if (!isChild && p.id) {
          try {
            const { data: prefs } = await supabase
              .from("user_preferences")
              .select("data")
              .eq("profile_id", p.id)
              .maybeSingle();
            if (prefs?.data) {
              const d = prefs.data as Record<string, any>;
              if (!city) city = d.city || d.medie_citta || d.superiori_citta || d.uni_nome || "";
              if (!schoolName) schoolName = d.school_name || "";
              if (!schoolCode) schoolCode = d.school_code || null;
              if (!classSection) classSection = d.classe || d.medie_anno || d.superiori_anno || d.uni_anno || "";
            }
          } catch {}
        }

        setSchoolData({ city, schoolName, schoolCode, classSection });

        if (p.school_level === "università") {
          loadStudyPlan(p.id).then(setStudyPlan);
        }

        // Load coach name from user_preferences
        if (p.id) {
          try {
            const { data: prefData } = await supabase
              .from("user_preferences")
              .select("data")
              .eq("profile_id", p.id)
              .maybeSingle();
            const cn = (prefData?.data as Record<string, any>)?.coach_name || "";
            setCoachName(cn);
            setOriginalCoachName(cn);
          } catch {}
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        gender: gender || null,
        interests,
        class_section: schoolData.classSection.trim() || null,
        school_name: schoolData.schoolName.trim() || null,
        school_code: schoolData.schoolCode || null,
        city: schoolData.city.trim() || null,
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

      // Save coach name if changed
      if (coachName !== originalCoachName && profile.id) {
        await (supabase.rpc as any)("save_coach_name", { p_profile_id: profile.id, p_coach_name: coachName.trim() || "" });
      }

      toast({ title: t("profile_saved") });
      navigate(-1);
    } catch (e) {
      toast({ title: t("profile_save_error"), variant: "destructive" });
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

  const hasChanges = gender !== ((profile as any).gender || "")
    || JSON.stringify(interests) !== JSON.stringify(profile.interests || [])
    || schoolData.classSection !== (profile.class_section || "")
    || schoolData.schoolName !== (profile.school_name || "")
    || schoolData.schoolCode !== (profile.school_code || null)
    || schoolData.city !== (profile.city || "")
    || coachName !== originalCoachName;

  const accessCode = profile?.access_code;
  const showAccessCode = !!accessCode || isChild || isChildLevel(profile.school_level);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">{t("profile_my_profile")}</span>
          </div>

          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="text-center">
            <div className="flex justify-center mb-3">
              <AvatarInitials name={profile.name || "U"} size="lg" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">{profile.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {[profile.age ? `${profile.age} anni` : "", schoolData.classSection ? normalizeClass(schoolData.classSection) : "", schoolData.schoolName, schoolData.city].filter(Boolean).join(" · ") || profile.school_level || ""}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Access Code — always visible for primaria/medie */}
          {showAccessCode && accessCode && <AccessCodeCard code={accessCode} />}

          {/* Coach Name */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircleHeart className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-foreground text-sm">{t("profile_coach_name_title") || "Nome del Coach"}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t("profile_coach_name_desc") || "Dai un nome al tuo coach AI personale"}</p>
            <input
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder={t("profile_coach_name_placeholder") || "Es. Luna, Sensei, Buddy…"}
              maxLength={20}
              className="w-full px-4 py-2 rounded-xl border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </motion.div>

          {/* Gender */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">{t("profile_gender_title")}</h3>
            <div className="flex gap-3">
              {[{ id: "M", label: t("profile_gender_male"), icon: User }, { id: "F", label: t("profile_gender_female"), icon: User }].map((g) => (
                <button key={g.id} onClick={() => setGender(g.id)} className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${gender === g.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                  <g.icon className="w-4 h-4" />
                  {g.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* School info — editable card */}
          <EditableSchoolCard
            data={schoolData}
            onChange={setSchoolData}
            delay={0.15}
          />

          {/* Interests */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-foreground text-sm">{t("profile_interests_title")}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{t("profile_interests_desc")}</p>

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

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && customInterest.trim() && addInterest(customInterest)}
                placeholder={t("profile_interests_add_placeholder")}
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

            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs text-primary font-medium hover:underline mb-3 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {showSuggestions ? t("profile_interests_suggestions_hide") : t("profile_interests_suggestions_show")}
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
              <p className="text-xs text-muted-foreground mt-2">{t("profile_interests_max")}</p>
            )}
          </motion.div>

          {/* University Study Plan */}
          {profile.school_level === "università" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-2xl border border-border p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-foreground text-sm">{t("profile_study_plan_title")}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{t("profile_study_plan_desc")}</p>
              <UniversityStudyPlan
                exams={studyPlan}
                onChange={(newPlan) => {
                  setStudyPlan(newPlan);
                  if (profile?.id) saveStudyPlan(profile.id, newPlan);
                }}
              />
            </motion.div>
          )}

          {/* Save */}
          {hasChanges && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button onClick={handleSave} disabled={saving} className="w-full rounded-2xl py-6 text-base font-medium">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("profile_save")}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
