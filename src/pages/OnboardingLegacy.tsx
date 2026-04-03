// MODIFICA: Feature 2 (Coach Name), Feature 3 (Class Dropdown),
// Feature 4 (Subject Logic Inversion), Feature 6 (Access Code Step),
// Feature 7 (Teacher Matching)
// Avatar selection removed — coach is always CoachAvatar component
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, BookOpen, Check, Copy, Mail, CheckCircle2, Users2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createChildProfile, setActiveChildProfileId } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession, clearChildSession, setChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { CoachAvatar } from "@/components/shared/CoachAvatar";
import { SchoolAutocomplete } from "@/components/shared/SchoolAutocomplete";
import { CityAutocomplete } from "@/components/shared/CityAutocomplete";
import { formatTeacherDisplay } from "@/lib/teacherTitle";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// MODIFICA: Feature 3 — Proper school level lists
const primaryClasses = [
  { id: "primaria-1", label: "1ª Elementare" },
  { id: "primaria-2", label: "2ª Elementare" },
  { id: "primaria-3", label: "3ª Elementare" },
  { id: "primaria-4", label: "4ª Elementare" },
  { id: "primaria-5", label: "5ª Elementare" },
];

const middleClasses = [
  { id: "media-1", label: "1ª Media" },
  { id: "media-2", label: "2ª Media" },
  { id: "media-3", label: "3ª Media" },
];

const subjects = ["Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte", "Musica", "Tecnologia"];

const PRIMARIA_INTERESTS = [
  { label: "Minecraft", emoji: "⛏️" }, { label: "Roblox", emoji: "🎮" }, { label: "LEGO", emoji: "🧱" },
  { label: "Pokémon", emoji: "⚡" }, { label: "Fortnite", emoji: "🎯" }, { label: "Dragon Ball", emoji: "🐉" },
  { label: "Harry Potter", emoji: "⚡" }, { label: "Marvel", emoji: "🦸" }, { label: "Calcio", emoji: "⚽" },
  { label: "Nuoto", emoji: "🏊" }, { label: "Danza", emoji: "💃" }, { label: "Karate", emoji: "🥋" },
  { label: "Disegno", emoji: "✏️" }, { label: "Musica", emoji: "🎵" }, { label: "Cucina", emoji: "🍕" },
  { label: "Dinosauri", emoji: "🦕" }, { label: "Cani", emoji: "🐶" }, { label: "Gatti", emoji: "🐱" },
  { label: "Cavalli", emoji: "🐴" }, { label: "Manga", emoji: "📚" }, { label: "Fumetti", emoji: "📖" },
  { label: "Lego Technic", emoji: "⚙️" }, { label: "Magia", emoji: "🪄" }, { label: "Natura", emoji: "🌿" },
];

const struggles = [
  { id: "distraction", label: "Si distrae facilmente" },
  { id: "refusal", label: "Rifiuta di iniziare" },
  { id: "anxiety", label: "Ansia da prestazione" },
  { id: "slowness", label: "È molto lento" },
  { id: "low-confidence", label: "Poca fiducia in sé" },
  { id: "poor-memory", label: "Fatica a ricordare" },
];

const supportStyles = [
  { id: "gentle", label: "Gentile e paziente" },
  { id: "playful", label: "Giocoso e leggero" },
  { id: "challenge", label: "Stimolante e sfidante" },
  { id: "calm", label: "Calmo e rassicurante" },
];

interface OnboardingData {
  name: string;
  lastName: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  schoolCategory: string;
  schoolLevel: string;
  schoolName: string;
  schoolCode: string | null;
  city: string;
  section: string;
  favoriteSubjects: string[];
  struggles: string[];
  focusTime: string;
  supportStyles: string[];
  coachName: string;
}

interface DiscoveredTeacher {
  teacher_id: string;
  name: string;
  last_name: string | null;
  gender: string | null;
  badge: string;
  classes: { class_id: string; class_name: string; subject: string | null; invite_code: string }[];
}

type StepType = "info" | "school" | "teachers" | "subjects" | "struggles" | "support" | "coach" | "interests" | "focus" | "access-code";

const BADGE_EMOJI: Record<string, string> = { verified: "🔵", school_recognized: "🟡", unverified: "⚪" };

const OnboardingLegacy = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<any>(null);
  const adultSession = getChildSession();
  const [customInterest, setCustomInterest] = useState("");

  // Teacher matching state
  const [discoveredTeachers, setDiscoveredTeachers] = useState<DiscoveredTeacher[]>([]);
  const [showTeacherStep, setShowTeacherStep] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [selectedInviteCodes, setSelectedInviteCodes] = useState<string[]>([]);
  const [joinedCodes, setJoinedCodes] = useState<Set<string>>(new Set());

  const [data, setData] = useState<OnboardingData & { interests: string[] }>({
    name: "", lastName: "", age: "", dateOfBirth: "", gender: "",
    schoolCategory: "", schoolLevel: "", schoolName: "", schoolCode: null, city: "",
    section: "",
    favoriteSubjects: [],
    struggles: [], focusTime: "15", supportStyles: [], coachName: "", interests: [],
  });

  // Dynamic step sequence — teacher step inserted only when teachers are found
  const steps: StepType[] = useMemo(() => {
    const base: StepType[] = ["info", "school", "subjects", "struggles", "support", "coach", "interests", "focus", "access-code"];
    if (showTeacherStep) {
      // Insert "teachers" after "school"
      return ["info", "school", "teachers", "subjects", "struggles", "support", "coach", "interests", "focus", "access-code"];
    }
    return base;
  }, [showTeacherStep]);

  const totalSteps = steps.length;
  const currentStepType = steps[step];

  const toggleInArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const canProceed = () => {
    switch (currentStepType) {
      case "info": return data.name.trim() !== "" && data.lastName.trim() !== "" && data.age !== "" && data.gender !== "";
      case "school": return data.schoolLevel !== "";
      case "teachers": return true;
      case "subjects": return true;
      case "struggles": return data.struggles.length > 0;
      case "support": return data.supportStyles.length > 0;
      case "coach": return true;
      case "interests": return true;
      case "focus": return true;
      case "access-code": return true;
      default: return false;
    }
  };

  const handleCopyCode = () => {
    if (createdProfile?.access_code) {
      navigator.clipboard.writeText(createdProfile.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendCodeEmail = async () => {
    toast({ title: "Il codice è stato copiato. Puoi incollarlo in un'email al tuo bambino." });
    handleCopyCode();
  };

  const toggleInviteCode = (code: string) => {
    setSelectedInviteCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const fetchTeachers = async (schoolCode: string) => {
    setLoadingTeachers(true);
    try {
      const { data: result } = await supabase.rpc("get_discoverable_teachers_with_classes" as any, {
        school_code_param: schoolCode,
      });
      const teachers = (result as DiscoveredTeacher[] | null) || [];
      // Only show teachers that have at least one class
      const withClasses = teachers.filter(t => t.classes && t.classes.length > 0);
      if (withClasses.length > 0) {
        setDiscoveredTeachers(withClasses);
        setShowTeacherStep(true);
        setLoadingTeachers(false);
        return true;
      }
    } catch (err) {
      console.error("fetchTeachers error:", err);
    }
    setShowTeacherStep(false);
    setDiscoveredTeachers([]);
    setLoadingTeachers(false);
    return false;
  };

  const joinSelectedClasses = async (profileId: string) => {
    for (const code of selectedInviteCodes) {
      try {
        await supabase.rpc("join_class_by_code", {
          code,
          student_profile_id: profileId,
        });
        setJoinedCodes(prev => new Set(prev).add(code));
      } catch (err) {
        console.error("join_class_by_code error:", err);
      }
    }
  };

  const next = async () => {
    // When leaving school step, check for teachers
    if (currentStepType === "school") {
      if (data.schoolCode) {
        setLoadingTeachers(true);
        const found = await fetchTeachers(data.schoolCode);
        if (found) {
          setStep(step + 1); // go to teachers step
          return;
        }
      }
      // No school_code or no teachers — skip teacher step
      setShowTeacherStep(false);
      setStep(step + 1);
      return;
    }

    // Create profile at focus step
    if (currentStepType === "focus") {
      setSaving(true);
      const allSubjects = subjects;
      const difficultSubjects = allSubjects.filter(s => !data.favoriteSubjects.includes(s));

      const schoolLevel = data.schoolLevel;

      const profile = await createChildProfile({
        name: data.name,
        last_name: data.lastName,
        avatar_emoji: null,
        age: parseInt(data.age) || undefined,
        gender: data.gender || undefined,
        school_level: schoolLevel,
        favorite_subjects: data.favoriteSubjects,
        difficult_subjects: difficultSubjects,
        struggles: data.struggles,
        focus_time: parseInt(data.focusTime) || 15,
        support_style: data.supportStyles.join(","),
        date_of_birth: data.dateOfBirth || undefined,
        interests: data.interests.length > 0 ? data.interests : undefined,
        school_name: data.schoolName || undefined,
        school_code: data.schoolCode || undefined,
        city: data.city || undefined,
      } as any);

      if (profile) {
        const prefsData: any = {};
        if (data.coachName.trim()) prefsData.coach_name = data.coachName.trim();
        if (data.section.trim()) prefsData.school_section = data.section.trim();
        if (Object.keys(prefsData).length > 0) {
          await supabase.from("user_preferences").upsert({
            profile_id: profile.id,
            data: prefsData,
          } as any);
        }

        await supabase.from("gamification").upsert({
          child_profile_id: profile.id,
          focus_points: 0, consistency_points: 0, autonomy_points: 0,
          streak: 0, streak_shields: 0, next_shield_at: 7,
        }, { onConflict: "child_profile_id" });

        const today = new Date().toISOString().split("T")[0];
        await supabase.from("daily_missions").insert([
          { child_profile_id: profile.id, mission_date: today, title: "Studia 15 minuti", description: "Completa una sessione di studio", points_reward: 10, completed: false, mission_type: "study_session" },
          { child_profile_id: profile.id, mission_date: today, title: "Aggiungi un compito", description: "Inserisci un compito da fare", points_reward: 5, completed: false, mission_type: "complete_task" },
        ]);

        // Join selected classes
        if (selectedInviteCodes.length > 0) {
          await joinSelectedClasses(profile.id);
        }

        setCreatedProfile(profile);
        setSaving(false);
        setStep(step + 1); // go to access-code step
      } else {
        setSaving(false);
        toast({ title: "Errore nella creazione del profilo", variant: "destructive" });
      }
      return;
    }

    if (currentStepType === "access-code") {
      if (createdProfile) {
        if (adultSession?.profile?.school_level && ["superiori", "universitario", "docente"].includes(adultSession.profile.school_level)) {
          clearChildSession();
        }
        setActiveChildProfileId(createdProfile.id);
        setChildSession({
          profileId: createdProfile.id,
          accessCode: createdProfile.access_code || "",
          profile: {
            id: createdProfile.id,
            name: createdProfile.name || data.name,
            age: createdProfile.age ?? (parseInt(data.age) || null),
            avatar_emoji: null,
            gender: createdProfile.gender || data.gender,
            school_level: createdProfile.school_level || data.schoolLevel,
            favorite_subjects: createdProfile.favorite_subjects || data.favoriteSubjects,
            difficult_subjects: createdProfile.difficult_subjects || null,
            struggles: createdProfile.struggles || data.struggles,
            focus_time: createdProfile.focus_time ?? (parseInt(data.focusTime) || 15),
            support_style: createdProfile.support_style || data.supportStyles.join(","),
            interests: createdProfile.interests || data.interests || null,
          },
        });
        localStorage.setItem("inschool-profile", JSON.stringify({
          id: createdProfile.id, name: data.name, age: data.age, gender: data.gender,
          schoolLevel: data.schoolLevel,
          favoriteSubjects: data.favoriteSubjects, focusTime: data.focusTime, supportStyles: data.supportStyles,
        }));
      }
      navigate("/dashboard");
      return;
    }

    if (step < totalSteps - 1) {
      if (currentStepType === "info") {
        const childAge = parseInt(data.age);
        if (childAge && childAge < 6) return;
      }
      setStep(step + 1);
    }
  };

  const renderStep = () => {
    switch (currentStepType) {
      case "info":
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come si chiama il bambino?</h2><p className="text-muted-foreground">Il coach lo chiamerà per nome.</p></div>
            <div className="space-y-4">
              <input type="text" placeholder="Nome" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg" />
              <input type="text" placeholder="Cognome" value={data.lastName} onChange={(e) => setData({ ...data, lastName: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg" />
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Genere</label>
                <div className="flex gap-3">
                  {[{ id: "M", label: "Maschio" }, { id: "F", label: "Femmina" }].map((g) => (
                    <button key={g.id} onClick={() => setData({ ...data, gender: g.id })} className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${data.gender === g.id ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{g.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Quanti anni ha?</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }, (_, i) => (i + 6).toString()).map((age) => (
                    <button key={age} onClick={() => setData({ ...data, age })} className={`w-12 h-12 rounded-xl font-display font-semibold text-lg transition-all ${data.age === age ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{age}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Data di nascita (opzionale)</label>
                <input type="date" value={data.dateOfBirth} onChange={(e) => setData({ ...data, dateOfBirth: e.target.value })} max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base" />
              </div>
            </div>
          </div>
        );

      case "school":
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Che classe fa {data.name}?</h2></div>
            <div className="flex gap-3 mb-4">
              {[
                { id: "primaria", label: "Scuola Primaria" },
                { id: "media", label: "Scuola Media" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setData({ ...data, schoolCategory: cat.id, schoolLevel: "" })}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                    data.schoolCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {data.schoolCategory && (
              <Select value={data.schoolLevel} onValueChange={(val) => setData({ ...data, schoolLevel: val })}>
                <SelectTrigger className="w-full rounded-xl h-12 text-base">
                  <SelectValue placeholder="Seleziona la classe" />
                </SelectTrigger>
                <SelectContent>
                  {(data.schoolCategory === "primaria" ? primaryClasses : middleClasses).map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="pt-2 space-y-3">
              <label className="text-sm text-muted-foreground block">{t("city_school_label")}</label>
              <CityAutocomplete
                value={data.city}
                onChange={(city) => {
                  setData(prev => ({
                    ...prev,
                    city,
                    schoolName: "",
                    schoolCode: null,
                  }));
                }}
              />

              <label className="text-sm text-muted-foreground block">{t("child_school_label")}</label>
              <SchoolAutocomplete
                value={data.schoolName}
                onChange={(name, code, city) => setData(prev => ({
                  ...prev,
                  schoolName: name,
                  schoolCode: code,
                  city: city || prev.city,
                }))}
                placeholder={t("school_search_placeholder")}
                cityFilter={data.city || undefined}
              />

              <label className="text-sm text-muted-foreground block">{t("onb_section_label")}</label>
              <input
                type="text"
                placeholder={t("onb_section_placeholder")}
                value={data.section}
                onChange={(e) => setData({ ...data, section: e.target.value.toUpperCase().slice(0, 2) })}
                maxLength={2}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg"
              />
            </div>
          </div>
        );

      case "teachers":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Users2 className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("onb_teachers_found_title", { name: data.name })}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("onb_teachers_found_subtitle")}
              </p>
            </div>

            <div className="space-y-3">
              {discoveredTeachers.map((teacher) => (
                <div key={teacher.teacher_id}>
                  {teacher.classes.map((cls) => {
                    const isSelected = selectedInviteCodes.includes(cls.invite_code);
                    return (
                      <button
                        key={cls.class_id}
                        type="button"
                        onClick={() => toggleInviteCode(cls.invite_code)}
                        className={`w-full text-left px-5 py-4 rounded-2xl border transition-all mb-2 ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-soft"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{BADGE_EMOJI[teacher.badge] || "⚪"}</span>
                              <span className="font-medium text-foreground">
                                {formatTeacherDisplay(teacher.name, teacher.last_name, teacher.gender?.toLowerCase())}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {cls.class_name}{cls.subject ? ` · ${cls.subject}` : ""}
                            </p>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {selectedInviteCodes.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {t("onb_teachers_selected", { count: selectedInviteCodes.length })}
              </p>
            )}

            <button onClick={() => { setSelectedInviteCodes([]); setStep(step + 1); }} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors block mx-auto">
              {t("skip")}
            </button>
          </div>
        );

      case "subjects":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Come vanno le materie di {data.name}?</h2>
              <p className="text-muted-foreground text-sm">Seleziona le materie in cui va bene. Quelle non selezionate saranno le aree su cui il coach si concentrerà di più.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setData({ ...data, favoriteSubjects: toggleInArray(data.favoriteSubjects, s) })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    data.favoriteSubjects.includes(s)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {data.favoriteSubjects.includes(s) && <Check className="w-3 h-3 inline mr-1" />}
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              Le materie non selezionate verranno considerate come aree di difficoltà.
            </p>
          </div>
        );

      case "struggles":
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Cosa succede quando studia?</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {struggles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, struggles: toggleInArray(data.struggles, s.id) })} className={`text-left px-4 py-4 rounded-2xl border transition-all ${data.struggles.includes(s.id) ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="font-medium text-foreground text-sm">{s.label}</span></button>))}
            </div>
          </div>
        );

      case "support":
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come deve aiutarlo il coach?</h2></div>
            <div className="space-y-3">
              {supportStyles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, supportStyles: toggleInArray(data.supportStyles, s.id) })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.supportStyles.includes(s.id) ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="font-medium text-foreground">{s.label}</span></button>))}
            </div>
          </div>
        );

      case "coach":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Come si chiama il coach di {data.name}?</h2>
              <p className="text-muted-foreground text-sm">Dai un nome al coach AI. Potrai cambiarlo dopo nelle impostazioni.</p>
            </div>
            <div className="flex justify-center">
              <CoachAvatar mood="default" size={80} />
            </div>
            <input
              type="text"
              placeholder="Es. Luna, Buddy, Stella..."
              value={data.coachName}
              onChange={(e) => setData({ ...data, coachName: e.target.value })}
              maxLength={20}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg text-center"
            />
            <p className="text-xs text-muted-foreground text-center">Puoi saltare questo step e scegliere il nome dopo.</p>
          </div>
        );

      case "interests": {
        const selected = data.interests;
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Cosa piace a {data.name}?</h2>
              <p className="text-muted-foreground text-sm">Il coach userà questi interessi per rendere lo studio più divertente! (facoltativo)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRIMARIA_INTERESTS.map(s => {
                const isSel = selected.includes(s.label);
                return (
                  <button key={s.label} onClick={() => {
                    if (isSel) setData({ ...data, interests: selected.filter(i => i !== s.label) });
                    else if (selected.length < 10) setData({ ...data, interests: [...selected, s.label] });
                  }} className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isSel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {s.emoji} {s.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input type="text" value={customInterest} onChange={e => setCustomInterest(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customInterest.trim() && selected.length < 10 && !selected.includes(customInterest.trim())) {
                    setData({ ...data, interests: [...selected, customInterest.trim()] });
                    setCustomInterest("");
                  }
                }}
                placeholder="Scrivi un interesse e premi +"
                maxLength={30}
                className="flex-1 px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (customInterest.trim() && selected.length < 10 && !selected.includes(customInterest.trim())) {
                    setData({ ...data, interests: [...selected, customInterest.trim()] });
                    setCustomInterest("");
                  }
                }}
                disabled={!customInterest.trim()}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                  customInterest.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                +
              </button>
            </div>
            {selected.length > 0 && <p className="text-xs text-muted-foreground">{selected.length}/10 selezionati</p>}
            <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">Salta</button>
          </div>
        );
      }

      case "focus":
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Quanto riesce a concentrarsi?</h2></div>
            <div className="space-y-3">
              {[{ val: "10", label: "10 minuti", desc: "Per iniziare" }, { val: "15", label: "15 minuti", desc: "Equilibrio" }, { val: "20", label: "20 minuti", desc: "Già bravo" }, { val: "25", label: "25 minuti", desc: "Campione di focus" }].map((opt) => (
                <button key={opt.val} onClick={() => setData({ ...data, focusTime: opt.val })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.focusTime === opt.val ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:bg-muted"}`}>
                  <div className="flex items-center justify-between"><div><span className="font-medium text-foreground">{opt.label}</span><span className="text-sm text-muted-foreground ml-2">— {opt.desc}</span></div>{data.focusTime === opt.val && <Check className="w-4 h-4 text-primary" />}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case "access-code":
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Profilo di {data.name} creato!</h2>
              <p className="text-muted-foreground text-sm">Ecco il codice di accesso univoco per {data.name}. Usalo per farlo entrare nella sua area personale.</p>
            </div>

            {joinedCodes.size > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                <p className="text-sm text-foreground font-medium">
                  ✅ {t("onb_teachers_joined", { count: joinedCodes.size })}
                </p>
              </div>
            )}

            <div className="bg-muted rounded-2xl px-6 py-5">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Codice di accesso</p>
              <p className="font-display text-3xl font-bold tracking-widest text-foreground">
                {createdProfile?.access_code || "—"}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCopyCode} className="flex-1 rounded-xl h-12">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copiato!" : "Copia codice"}
              </Button>
              <Button variant="outline" onClick={handleSendCodeEmail} className="flex-1 rounded-xl h-12">
                <Mail className="w-4 h-4 mr-2" />
                Invia via email
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">Conserva questo codice. Il bambino lo userà per accedere alla sua area di studio.</p>
          </div>
        );
    }
  };

  const isLastContentStep = currentStepType === "access-code";
  const isSaveStep = currentStepType === "focus";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-primary-foreground" /></div>
            <span className="font-display text-lg font-semibold text-foreground">Nuovo profilo</span>
          </div>
          <span className="text-sm text-muted-foreground">{Math.min(step + 1, totalSteps)} di {totalSteps}</span>
        </div>
        <div className="max-w-lg mx-auto mt-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((Math.min(step + 1, totalSteps)) / totalSteps) * 100}%` }} transition={spring} />
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-start justify-center px-6 pt-8 pb-32">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={spring}>
              {loadingTeachers ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">{t("onb_teachers_loading")}</p>
                </div>
              ) : (
                renderStep()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => step > 0 && !isLastContentStep ? setStep(step - 1) : step === 0 ? navigate("/profiles") : null} disabled={isLastContentStep} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>
          <Button onClick={next} disabled={!canProceed() || saving || loadingTeachers} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl px-6 disabled:opacity-40">
            {isLastContentStep ? "Vai alla dashboard" : isSaveStep ? (saving ? "Salvataggio..." : "Crea profilo!") : currentStepType === "teachers" && selectedInviteCodes.length > 0 ? t("onb_teachers_join_btn") : "Avanti"}<ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingLegacy;
