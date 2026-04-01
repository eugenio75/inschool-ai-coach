import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  ArrowRight, ArrowLeft, Timer, Brain, Sliders, TrendingUp, 
  FileCheck, BookOpen, Calendar, Lightbulb, ClipboardCheck, 
  Search, Network, Mic, PenLine, FileText, FolderOpen, Home, 
  Users2, Building, FilePlus, CheckSquare, BarChart2, BookMarked, Mail, Users
} from "lucide-react";
import { SchoolAutocomplete } from "@/components/shared/SchoolAutocomplete";
import { CityAutocomplete } from "@/components/shared/CityAutocomplete";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession, setChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import OnboardingLegacy from "./OnboardingLegacy";
import { CoachAvatar } from "@/components/shared/CoachAvatar";
import { JoinClassInline } from "@/components/JoinClassModal";

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3 } },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0, transition: { duration: 0.3 } })
};

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>({});
  const [initialStep, setInitialStep] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    const check = async () => {
      const session = getChildSession();
      if (session?.profile) {
        setRole(session.profile.school_level);
        setProfileId(session.profile.id);
        const { data } = await (supabase.from as any)("user_preferences").select("*").eq("profile_id", session.profile.id).maybeSingle() as any;
        if (data && data.current_step !== undefined) {
           setInitialStep(data.current_step);
           setInitialData(data.data || {});
        }
         setLoadingData(false);
         return;
      }

      if (user) {
        const { data: profiles } = await supabase
          .from("child_profiles")
          .select("*")
          .eq("parent_id", user.id)
          .in("school_level", ["superiori", "universitario", "docente"])
          .order("created_at", { ascending: false });

        if (profiles && profiles.length > 0) {
          const incompleteProfile = profiles.find((profile) => !profile.onboarding_completed) || profiles[0];
          setChildSession({
            profileId: incompleteProfile.id,
            accessCode: incompleteProfile.access_code || "",
            profile: incompleteProfile as any,
          });
          setRole(incompleteProfile.school_level);
          setProfileId(incompleteProfile.id);

          const { data } = await (supabase.from as any)("user_preferences")
            .select("*")
            .eq("profile_id", incompleteProfile.id)
            .maybeSingle() as any;

          if (data && data.current_step !== undefined) {
            setInitialStep(data.current_step);
            setInitialData(data.data || {});
          }
          setLoadingData(false);
          return;
        }
      }

      setLoadingData(false);
    };
    check();
  }, [user, loading]);

  if (loading || loadingData) return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (["superiori", "universitario", "docente"].includes(role || "")) {
    return <OnboardingAdult role={role!} profileId={profileId!} initialStep={initialStep} initialData={initialData} />;
  }
  return <OnboardingLegacy />;
}

// Shared classes for onboarding elements
const selBtnClass = "border-primary bg-primary/10 shadow-sm";
const unselBtnClass = "border-border hover:bg-muted/50";
const selIconClass = "text-primary";
const unselIconClass = "text-muted-foreground";
const selTextClass = "text-foreground";
const unselTextClass = "text-muted-foreground";
const inputClass = "w-full p-4 rounded-xl border border-border bg-muted/50 outline-none focus:border-primary text-foreground";
const chipSelClass = "bg-primary text-primary-foreground";
const chipUnselClass = "bg-muted text-muted-foreground hover:bg-accent";
const summaryBoxClass = "bg-muted/50 border border-border rounded-2xl p-6 space-y-4 shadow-sm";
const summaryLabelClass = "text-xs font-bold text-muted-foreground uppercase tracking-wider";
const summaryValueClass = "font-medium text-foreground";

function OnboardingAdult({ role, profileId, initialStep, initialData }: any) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const hasClassCodeStep = role === "medie" || role === "superiori";
    const totalSteps = role === "docente" ? 5 : (hasClassCodeStep ? 10 : 9);
    const normalizedInitialStep = Number.isFinite(Number(initialStep)) ? Number(initialStep) : 0;
    const [step, setStep] = useState(() => Math.min(Math.max(normalizedInitialStep, 0), totalSteps - 1));
    const [answers, setAnswers] = useState<any>(initialData || {});
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);
    const locationInputRef = useRef<HTMLInputElement>(null);
    const currentStep = Number.isFinite(step) ? step : 0;
    console.log("currentStep:", currentStep);

    useEffect(() => {
      if (!Number.isFinite(step)) {
        setStep(0);
        return;
      }

      if (step < 0 || step > totalSteps - 1) {
        setStep(Math.min(Math.max(step, 0), totalSteps - 1));
      }
    }, [step, totalSteps]);

    useEffect(() => {
        let autocomplete: any = null;
        if (locationInputRef.current && (window as any).google) {
            autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, { types: ["school", "university"] });
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete?.getPlace();
                if (place?.name) {
                    const key = role === "superiori" ? "superiori_scuola" : role === "universitario" ? "uni_nome" : "docente_istituto";
                    setAnswers((prev: any) => ({ ...prev, [key]: place.name }));
                }
            });
        }
        return () => { if (autocomplete) (window as any).google.maps.event.clearInstanceListeners(autocomplete); }
    }, [currentStep, role]);

    const handleNext = async () => {
        if (currentStep < totalSteps - 1) {
            const nextStep = currentStep + 1;
            setSaving(true);
            const { data: existingPref } = await supabase
              .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
            const existingData = (existingPref?.data as any) || {};
            const mergedData = { ...existingData, ...answers };
            await (supabase.from as any)("user_preferences").upsert({
               profile_id: profileId, role: role, current_step: nextStep, data: mergedData
            });
            setSaving(false);
            setDirection(1);
            setStep(nextStep);
        } else {
            setSaving(true);
            const { data: existingPref } = await supabase
              .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
            const existingData = (existingPref?.data as any) || {};
            const mergedData = { ...existingData, ...answers };
            await (supabase as any).from("user_preferences").upsert({
               profile_id: profileId, role: role, current_step: currentStep, data: mergedData
            });
            const profileUpdates: any = { onboarding_completed: true };
            const interestsToSave = Array.isArray(answers.interests) ? answers.interests.filter((i: unknown) => typeof i === "string" && i.trim()) : [];
            console.log("[Onboarding] Saving interests:", interestsToSave);
            if (interestsToSave.length > 0) profileUpdates.interests = interestsToSave;
            if (role === "docente" && answers.docente_gender) profileUpdates.gender = answers.docente_gender;
            await supabase.from("child_profiles").update(profileUpdates as any).eq("id", profileId);
            const currentSession = getChildSession();
            if (currentSession?.profile) {
              setChildSession({
                ...currentSession,
                profile: { ...currentSession.profile, onboarding_completed: true } as any,
              });
            }
            setSaving(false);
            navigate("/dashboard");
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setDirection(-1);
            setStep(currentStep - 1);
        }
    };

    const toggleArray = (key: string, val: string) => {
        setAnswers((prev: any) => {
            const arr = prev[key] || [];
            if (arr.includes(val)) return { ...prev, [key]: arr.filter((x: string) => x !== val) };
            return { ...prev, [key]: [...arr, val] };
        });
    };

    const toggleArrayMax = (key: string, val: string, max: number) => {
        setAnswers((prev: any) => {
            const arr = prev[key] || [];
            if (arr.includes(val)) return { ...prev, [key]: arr.filter((x: string) => x !== val) };
            if (arr.length >= max) return prev;
            return { ...prev, [key]: [...arr, val] };
        });
    };

    const canProceed = () => {
        if (role === "medie") {
            if (currentStep === 1) return answers.medie_anno && answers.medie_scuola_tipo;
            if (currentStep === 2) return (answers.materie_critiche || []).length > 0;
            if (currentStep === 3) return answers.metodo_studio;
            if (currentStep === 4) return answers.obiettivo;
        } else if (role === "superiori") {
            if (currentStep === 1) return answers.superiori_anno && answers.superiori_indirizzo;
            if (currentStep === 2) return (answers.materie_critiche || []).length > 0;
            if (currentStep === 3) return answers.metodo_studio;
            if (currentStep === 4) return answers.obiettivo;
        } else if (role === "universitario") {
            if (currentStep === 1) return answers.uni_facolta && answers.uni_anno;
            if (currentStep === 3) return answers.metodo_studio;
            if (currentStep === 4) return (answers.serve_ai || []).length > 0;
        } else if (role === "docente") {
            if (currentStep === 1) return answers.docente_gender && answers.docente_ordine && (answers.docente_materie || []).length > 0;
            return true;
        }
        return true;
    };

    // Subject keys map — internal value -> i18n key
    const subjectKey = (s: string): string => {
      const map: Record<string, string> = {
        "Matematica": "subject_matematica", "Italiano": "subject_italiano", "Inglese": "subject_inglese",
        "Storia": "subject_storia", "Geografia": "subject_geografia", "Scienze": "subject_scienze",
        "Tecnologia": "subject_tecnologia", "Francese": "subject_francese", "Spagnolo": "subject_spagnolo",
        "Musica": "subject_musica", "Arte": "subject_arte", "Fisica": "subject_fisica",
        "Chimica": "subject_chimica", "Latino": "subject_latino", "Filosofia": "subject_filosofia",
        "Informatica": "subject_informatica", "Greco": "subject_greco", "Economia": "subject_economia",
        "Diritto": "subject_diritto", "Lingue": "subject_lingue", "Educazione Fisica": "subject_ed_fisica",
        "Educazione Civica": "subject_ed_civica", "Religione": "subject_religione", "Tedesco": "subject_tedesco",
      };
      return map[s] || s;
    };

    const INTERESTS_BY_LEVEL: Record<string, { label: string; emoji?: string }[]> = {
      medie: [
        { label: "Minecraft", emoji: "⛏️" }, { label: "Roblox", emoji: "🎮" }, { label: "Fortnite", emoji: "🎯" },
        { label: "Anime/Manga", emoji: "🐉" }, { label: "Marvel/DC", emoji: "🦸" }, { label: "Calcio", emoji: "⚽" },
        { label: "Basket", emoji: "🏀" }, { label: "Danza", emoji: "💃" }, { label: "Musica", emoji: "🎵" },
        { label: "Disegno", emoji: "✏️" }, { label: "Fotografia", emoji: "📷" }, { label: "YouTube/TikTok", emoji: "📱" },
        { label: "Gaming", emoji: "🎮" }, { label: "Cucina", emoji: "🍕" }, { label: "Animali", emoji: "🐾" },
        { label: "Lettura", emoji: "📚" }, { label: "Serie TV", emoji: "🎬" }, { label: "Karate/Arti marziali", emoji: "🥋" },
        { label: "Tecnologia", emoji: "💻" }, { label: "Natura", emoji: "🌿" },
      ],
      alunno: [
        { label: "Minecraft", emoji: "⛏️" }, { label: "Roblox", emoji: "🎮" }, { label: "LEGO", emoji: "🧱" },
        { label: "Pokémon", emoji: "⚡" }, { label: "Fortnite", emoji: "🎯" }, { label: "Dragon Ball", emoji: "🐉" },
        { label: "Harry Potter", emoji: "⚡" }, { label: "Marvel", emoji: "🦸" }, { label: "Calcio", emoji: "⚽" },
        { label: "Nuoto", emoji: "🏊" }, { label: "Danza", emoji: "💃" }, { label: "Karate", emoji: "🥋" },
        { label: "Disegno", emoji: "✏️" }, { label: "Musica", emoji: "🎵" }, { label: "Cucina", emoji: "🍕" },
        { label: "Dinosauri", emoji: "🦕" }, { label: "Cani", emoji: "🐶" }, { label: "Gatti", emoji: "🐱" },
        { label: "Cavalli", emoji: "🐴" }, { label: "Manga", emoji: "📚" }, { label: "Fumetti", emoji: "📖" },
        { label: "Lego Technic", emoji: "⚙️" }, { label: "Magia", emoji: "🪄" }, { label: "Natura", emoji: "🌿" },
      ],
      superiori: [
        { label: "Sport" }, { label: "Musica" }, { label: "Arte" }, { label: "Tecnologia" },
        { label: "Viaggi" }, { label: "Cinema" }, { label: "Fotografia" }, { label: "Videogiochi" },
        { label: "Lettura" }, { label: "Moda" }, { label: "Scienza" }, { label: "Social media" },
        { label: "Cucina" }, { label: "Animali" }, { label: "Ambiente" }, { label: "Serie TV" },
      ],
      universitario: [
        { label: "Tecnologia" }, { label: "Viaggi" }, { label: "Arte" }, { label: "Musica" },
        { label: "Sport" }, { label: "Letteratura" }, { label: "Scienza" }, { label: "Economia" },
        { label: "Cinema" }, { label: "Fotografia" }, { label: "Sostenibilità" }, { label: "Startup" },
      ],
    };

    function renderInterestsStep(level: string) {
      try {
        const levelSuggestions = INTERESTS_BY_LEVEL[level];
        const suggestions = Array.isArray(levelSuggestions)
          ? levelSuggestions
          : (Array.isArray(INTERESTS_BY_LEVEL.medie) ? INTERESTS_BY_LEVEL.medie : []);

        const selected: string[] = Array.isArray(answers?.interests)
          ? answers.interests.filter((item: unknown): item is string => typeof item === "string")
          : [];

        const customVal = typeof answers?._interestCustom === "string" ? answers._interestCustom : "";
        const hasEmoji = suggestions.some((s) => Boolean(s?.emoji));

        const toggleInterest = (label: string) => {
          setAnswers((prev: any) => {
            const prevSelected: string[] = Array.isArray(prev?.interests)
              ? prev.interests.filter((item: unknown): item is string => typeof item === "string")
              : [];

            if (prevSelected.includes(label)) {
              return { ...prev, interests: prevSelected.filter((i: string) => i !== label) };
            }

            if (prevSelected.length >= 10) return prev;
            return { ...prev, interests: [...prevSelected, label] };
          });
        };

        const addCustomInterest = () => {
          setAnswers((prev: any) => {
            const trimmed = (typeof prev?._interestCustom === "string" ? prev._interestCustom : "").trim();
            if (!trimmed) return prev;

            const prevSelected: string[] = Array.isArray(prev?.interests)
              ? prev.interests.filter((item: unknown): item is string => typeof item === "string")
              : [];

            if (prevSelected.length >= 10 || prevSelected.includes(trimmed)) {
              return { ...prev, _interestCustom: "" };
            }

            return { ...prev, interests: [...prevSelected, trimmed], _interestCustom: "" };
          });
        };

        return (
          <div className="w-full space-y-6">
            <h2 className="text-2xl font-bold text-foreground">{t('onb_interests_title')}</h2>
            <p className="text-muted-foreground text-sm">{t('onb_interests_sub')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const isSel = selected.includes(s.label);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => toggleInterest(s.label)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isSel ? chipSelClass : chipUnselClass}`}
                  >
                    {hasEmoji && s.emoji ? `${s.emoji} ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customVal}
                onChange={(e) => setAnswers((prev: any) => ({ ...prev, _interestCustom: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomInterest();
                  }
                }}
                placeholder={t('onb_interests_add')}
                maxLength={30}
                className={inputClass}
              />
              <button
                type="button"
                onClick={addCustomInterest}
                disabled={!customVal.trim()}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                  customVal.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {t('onb_interests_add_btn')}
              </button>
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground">{selected.length}/10 {t('onb_interests_selected')}</p>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {t('onb_interests_skip')}
            </button>
          </div>
        );
      } catch (error) {
        console.error("[Onboarding] Interests step render crash", error);
        return (
          <div className="w-full space-y-6">
            <button
              type="button"
              onClick={handleNext}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {t('onb_interests_skip_now')}
            </button>
          </div>
        );
      }
    }

    function renderMedie(step: number) {
      const medieAnni = [
        { value: "1ª Media", key: "onb_medie_1" },
        { value: "2ª Media", key: "onb_medie_2" },
        { value: "3ª Media", key: "onb_medie_3" },
      ];
      const schoolTypes = [
        { value: "Scuola pubblica", key: "onb_school_public" },
        { value: "Scuola paritaria", key: "onb_school_paritaria" },
        { value: "Scuola privata", key: "onb_school_private" },
      ];
      switch (step) {
        case 0:
          return (
            <div className="text-center w-full">
                <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_welcome')}</h2>
                <p className="text-muted-foreground mb-8">{t('onb_configure')}</p>
                <div className="w-24 h-24 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"><BookOpen className="w-12 h-12" /></div>
            </div>
          );
        case 1:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_your_school')}</h2>
                <div className="space-y-4">
                   <select value={answers.medie_anno || ""} onChange={e => setAnswers({...answers, medie_anno: e.target.value})} className={inputClass}>
                      <option value="" disabled>{t('onb_class_prompt')}</option>
                      {medieAnni.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                   </select>
                   <select value={answers.medie_scuola_tipo || ""} onChange={e => setAnswers({...answers, medie_scuola_tipo: e.target.value})} className={inputClass}>
                      <option value="" disabled>{t('onb_school_type')}</option>
                      {schoolTypes.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                   </select>
                   <CityAutocomplete
                     value={answers.medie_citta || ""}
                     onChange={(city) => setAnswers((prev: any) => ({
                       ...prev,
                       medie_citta: city,
                       medie_scuola: "",
                       school_name: "",
                       school_code: null,
                     }))}
                     className={inputClass}
                   />
                   <SchoolAutocomplete
                     value={answers.medie_scuola || ""}
                     onChange={(name, code, city) => setAnswers((prev: any) => ({
                       ...prev,
                       medie_scuola: name,
                       school_name: name,
                       school_code: code,
                       ...(city ? { medie_citta: city } : {}),
                     }))}
                     placeholder={t('onb_school_name_optional')}
                     className={inputClass}
                     cityFilter={answers.medie_citta || undefined}
                   />
                </div>
            </div>
          );
        case 2: {
          const materie = ["Matematica", "Italiano", "Inglese", "Storia", "Geografia", "Scienze", "Tecnologia", "Francese", "Spagnolo", "Musica", "Arte"];
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_hard_subjects')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_hard_subjects_prompt')} ({t('onb_max')} 4)</p>
                <div className="flex flex-wrap gap-2 mt-4">
                    {materie.map((m: string) => {
                       const isSel = (answers.materie_critiche || []).includes(m);
                       return <button key={m} onClick={() => toggleArrayMax("materie_critiche", m, 4)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isSel ? chipSelClass : chipUnselClass}`}>{t(subjectKey(m))}</button>;
                    })}
                </div>
            </div>
          );
        }
        case 3:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_study_pref')}</h2>
                <div className="space-y-3">
                   {[
                     { id: "poco_spesso", title: t('onb_study_short'), sub: t('onb_study_short_sub'), icon: Timer },
                     { id: "lungo", title: t('onb_study_long'), sub: t('onb_study_long_sub'), icon: Brain },
                     { id: "non_so", title: t('onb_study_none'), sub: t('onb_study_none_sub'), icon: Lightbulb }
                   ].map(opt => {
                     const isSel = answers.metodo_studio === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, metodo_studio: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? selIconClass : unselIconClass}`}/><div className="text-left"><p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p><p className="text-sm text-muted-foreground">{opt.sub}</p></div></button>
                   })}
                </div>
            </div>
          );
        case 4:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_improve')}</h2>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { id: "voti", title: t('onb_improve_grades'), icon: TrendingUp },
                     { id: "organizzazione", title: t('onb_improve_org'), icon: Calendar },
                     { id: "interrogazioni", title: t('onb_improve_prep'), icon: FileCheck },
                     { id: "capire", title: t('onb_improve_understand'), icon: Lightbulb }
                   ].map(opt => {
                     const isSel = answers.obiettivo === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, obiettivo: opt.id})} className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-8 h-8 mb-3 ${isSel ? selIconClass : unselIconClass}`}/><span className={`font-bold text-sm text-center ${isSel ? selTextClass : unselTextClass}`}>{opt.title}</span></button>
                   })}
                </div>
            </div>
          );
        case 5:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_feelings')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_feelings_help')}</p>
                <div className="space-y-3">
                   {[
                     { id: "ok", title: t('onb_feel_ok'), sub: t('onb_feel_ok_sub') },
                     { id: "fatica", title: t('onb_feel_focus'), sub: t('onb_feel_focus_sub') },
                     { id: "ansia", title: t('onb_feel_anxiety'), sub: t('onb_feel_anxiety_sub') },
                     { id: "noia", title: t('onb_feel_bored'), sub: t('onb_feel_bored_sub') },
                   ].map(opt => {
                     const isSel = (answers.sfide_emotive || []).includes(opt.id);
                     return <button key={opt.id} onClick={() => {
                       const arr = answers.sfide_emotive || [];
                       if (arr.includes(opt.id)) setAnswers({...answers, sfide_emotive: arr.filter((x: string) => x !== opt.id)});
                       else if (arr.length < 2) setAnswers({...answers, sfide_emotive: [...arr, opt.id]});
                     }} className={`w-full flex items-start p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}>
                       <div className="text-left"><p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p><p className="text-sm text-muted-foreground">{opt.sub}</p></div>
                     </button>;
                   })}
                </div>
            </div>
          );
        case 6:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_coach_name')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_coach_name_sub')}</p>
                <div className="flex justify-center mb-2">
                  <CoachAvatar mood="default" size={80} />
                </div>
                <input type="text" placeholder={t('onb_coach_placeholder')} value={answers.coach_name || ""} onChange={e => setAnswers({...answers, coach_name: e.target.value})} className={inputClass} maxLength={20} />
                <p className="text-xs text-muted-foreground text-center">{t('onb_coach_change')}</p>
            </div>
          );
        case 7:
          return renderInterestsStep("medie");
        case 8:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_class_code_title')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_class_code_description')}</p>
                <JoinClassInline profileId={profileId} onJoined={(result: any) => setAnswers({...answers, joined_class: result})} />
                {!answers.joined_class && (
                  <button onClick={handleNext} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                    {t('onb_class_code_skip')}
                  </button>
                )}
            </div>
          );
        case 9:
          return (
            <div className="text-left w-full space-y-6">
                <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_all_set')}</h2>
                <p className="text-muted-foreground mb-6">{t('onb_your_profile')}</p>
                <div className={summaryBoxClass}>
                    <div><span className={summaryLabelClass}>{t('onb_summary_class')}</span><p className={summaryValueClass}>{answers.medie_anno}</p></div>
                    <div><span className={summaryLabelClass}>{t('onb_summary_hard')}</span><p className={summaryValueClass}>{(answers.materie_critiche || []).join(", ")}</p></div>
                    <div><span className={summaryLabelClass}>{t('onb_summary_method')}</span><p className={summaryValueClass}>{answers.metodo_studio === "poco_spesso" ? t('onb_summary_method_short') : answers.metodo_studio === "lungo" ? t('onb_summary_method_long') : t('onb_summary_method_discover')}</p></div>
                    {answers.coach_name && <div><span className={summaryLabelClass}>{t('onb_summary_coach')}</span><p className={summaryValueClass}>{answers.coach_name}</p></div>}
                    {(answers.interests || []).length > 0 && <div><span className={summaryLabelClass}>{t('onb_summary_interests')}</span><p className={summaryValueClass}>{(answers.interests || []).join(", ")}</p></div>}
                    {answers.joined_class && <div><span className={summaryLabelClass}>{t('onb_summary_class_enrolled')}</span><p className={summaryValueClass}>{answers.joined_class.class_name}</p></div>}
                </div>
            </div>
          );
      }
    }

    function renderSuperiori(step: number) {
      const supAnni = [
        { value: "1ª", key: "onb_sup_1" },
        { value: "2ª", key: "onb_sup_2" },
        { value: "3ª", key: "onb_sup_3" },
        { value: "4ª", key: "onb_sup_4" },
        { value: "5ª Superiore", key: "onb_sup_5" },
      ];
      const tracks = [
        { value: "Scientifico", key: "onb_track_scientifico" },
        { value: "Classico", key: "onb_track_classico" },
        { value: "Linguistico", key: "onb_track_linguistico" },
        { value: "Tecnico Economico", key: "onb_track_tecn_eco" },
        { value: "Tecnico Tecnologico", key: "onb_track_tecn_tech" },
        { value: "Professionale", key: "onb_track_prof" },
        { value: "Artistico", key: "onb_track_art" },
        { value: "Altro", key: "onb_track_other" },
      ];
      switch (step) {
        case 0:
          return (
            <div className="text-center w-full">
                <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_welcome')}</h2>
                <p className="text-muted-foreground mb-8">{t('onb_configure_adult')}</p>
                <div className="w-24 h-24 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"><BookOpen className="w-12 h-12" /></div>
            </div>
          );
        case 1:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_path')}</h2>
                <div className="space-y-4">
                   <select value={answers.superiori_anno || ""} onChange={e => setAnswers({...answers, superiori_anno: e.target.value})} className={inputClass}>
                      <option value="" disabled>{t('onb_select_year')}</option>
                      {supAnni.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                   </select>
                   <select value={answers.superiori_indirizzo || ""} onChange={e => setAnswers({...answers, superiori_indirizzo: e.target.value})} className={inputClass}>
                      <option value="" disabled>{t('onb_select_track')}</option>
                      {tracks.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                   </select>
                   <CityAutocomplete
                     value={answers.superiori_citta || ""}
                     onChange={(city) => setAnswers((prev: any) => ({
                       ...prev,
                       superiori_citta: city,
                       superiori_scuola: "",
                       school_name: "",
                       school_code: null,
                     }))}
                     className={inputClass}
                   />
                   <SchoolAutocomplete
                     value={answers.superiori_scuola || ""}
                     onChange={(name, code, city) => setAnswers((prev: any) => ({
                       ...prev,
                       superiori_scuola: name,
                       school_name: name,
                       school_code: code,
                       ...(city ? { superiori_citta: city } : {}),
                     }))}
                     placeholder={t('onb_school_name_optional')}
                     className={inputClass}
                     cityFilter={answers.superiori_citta || undefined}
                   />
                </div>
            </div>
          );
        case 2: {
          const materie = answers.superiori_indirizzo === "Scientifico" ? ["Matematica", "Fisica", "Chimica", "Latino", "Inglese", "Storia", "Filosofia", "Informatica", "Scienze", "Arte"] : 
                          answers.superiori_indirizzo === "Classico" ? ["Greco", "Latino", "Italiano", "Matematica", "Fisica", "Storia", "Filosofia", "Arte", "Inglese"] :
                          ["Matematica", "Italiano", "Storia", "Inglese", "Scienze", "Fisica", "Chimica", "Economia", "Informatica", "Diritto", "Lingue"];
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_critical_subjects')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_critical_subjects_prompt')} ({t('onb_max')} 5)</p>
                <div className="flex flex-wrap gap-2 mt-4">
                    {materie.map((m: string) => {
                       const isSel = (answers.materie_critiche || []).includes(m);
                       return <button key={m} onClick={() => toggleArrayMax("materie_critiche", m, 5)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isSel ? chipSelClass : chipUnselClass}`}>{t(subjectKey(m))}</button>;
                    })}
                </div>
            </div>
          );
        }
        case 3:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_study_better')}</h2>
                <div className="space-y-3">
                   {[
                     { id: "pomodoro", title: t('onb_study_pomodoro'), sub: t('onb_study_pomodoro_sub'), icon: Timer },
                     { id: "deep", title: t('onb_study_deep'), sub: t('onb_study_deep_sub'), icon: Brain },
                     { id: "flex", title: t('onb_study_flex'), sub: t('onb_study_flex_sub'), icon: Sliders }
                   ].map(opt => {
                     const isSel = answers.metodo_studio === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, metodo_studio: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? selIconClass : unselIconClass}`}/><div className="text-left"><p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p><p className="text-sm text-muted-foreground">{opt.sub}</p></div></button>
                   })}
                </div>
            </div>
          );
        case 4:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_main_goal')}</h2>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { id: "lacune", title: t('onb_goal_gaps'), icon: TrendingUp },
                     { id: "esami", title: t('onb_goal_exams'), icon: FileCheck },
                     { id: "approfondire", title: t('onb_goal_deepen'), icon: BookOpen },
                     { id: "organizzare", title: t('onb_goal_organize'), icon: Calendar }
                   ].map(opt => {
                     const isSel = answers.obiettivo === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, obiettivo: opt.id})} className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-8 h-8 mb-3 ${isSel ? selIconClass : unselIconClass}`}/><span className={`font-bold text-sm text-center ${isSel ? selTextClass : unselTextClass}`}>{opt.title}</span></button>
                   })}
                </div>
            </div>
          );
        case 5:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_feel_school_sup')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_feel_school_help')}</p>
                <div className="space-y-3">
                   {[
                     { id: "ansioso", title: t('onb_feel_anxious'), sub: t('onb_feel_anxious_sub') },
                     { id: "svogliato", title: t('onb_feel_unmotivated'), sub: t('onb_feel_unmotivated_sub') },
                     { id: "insicuro", title: t('onb_feel_insecure'), sub: t('onb_feel_insecure_sub') },
                     { id: "tranquillo", title: t('onb_feel_calm'), sub: t('onb_feel_calm_sub') },
                   ].map(opt => {
                     const isSel = (answers.sfide_emotive || []).includes(opt.id);
                     return <button key={opt.id} onClick={() => {
                       const arr = answers.sfide_emotive || [];
                       if (arr.includes(opt.id)) setAnswers({...answers, sfide_emotive: arr.filter((x: string) => x !== opt.id)});
                       else if (arr.length < 2) setAnswers({...answers, sfide_emotive: [...arr, opt.id]});
                     }} className={`w-full flex items-start p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}>
                       <div className="text-left"><p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p><p className="text-sm text-muted-foreground">{opt.sub}</p></div>
                     </button>;
                   })}
                </div>
            </div>
          );
        case 6:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_coach_name')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_coach_name_sup_sub')}</p>
                <div className="flex justify-center mb-2">
                  <CoachAvatar mood="default" size={80} />
                </div>
                <input type="text" placeholder={t('onb_coach_name_sup_placeholder')} value={answers.coach_name || ""} onChange={e => setAnswers({...answers, coach_name: e.target.value})} className={inputClass} maxLength={20} />
                <p className="text-xs text-muted-foreground text-center">{t('onb_coach_name_sup_change')}</p>
            </div>
          );
        case 7:
          return renderInterestsStep("superiori");
        case 8:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{t('onb_class_code_title')}</h2>
                <p className="text-muted-foreground text-sm">{t('onb_class_code_description')}</p>
                <JoinClassInline profileId={profileId} onJoined={(result: any) => setAnswers({...answers, joined_class: result})} />
                {!answers.joined_class && (
                  <button onClick={handleNext} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                    {t('onb_class_code_skip')}
                  </button>
                )}
            </div>
          );
        case 9:
          return (
            <div className="text-left w-full space-y-6">
                <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_all_set')}</h2>
                <p className="text-muted-foreground mb-6">{t('onb_your_academic_profile')}</p>
                <div className={summaryBoxClass}>
                    <div><span className={summaryLabelClass}>{t('onb_summary_track')}</span><p className={summaryValueClass}>{answers.superiori_anno} {answers.superiori_indirizzo}</p></div>
                    <div><span className={summaryLabelClass}>{t('onb_summary_focus_subjects')}</span><p className={summaryValueClass}>{(answers.materie_critiche || []).join(", ")}</p></div>
                    <div><span className={summaryLabelClass}>{t('onb_summary_method')}</span><p className={summaryValueClass}>{answers.metodo_studio === "pomodoro" ? t('onb_summary_method_pomodoro') : answers.metodo_studio === "deep" ? t('onb_summary_method_deep') : t('onb_summary_method_flex')}</p></div>
                    {answers.coach_name && <div><span className={summaryLabelClass}>{t('onb_summary_coach')}</span><p className={summaryValueClass}>{answers.coach_name}</p></div>}
                    {(answers.interests || []).length > 0 && <div><span className={summaryLabelClass}>{t('onb_summary_interests')}</span><p className={summaryValueClass}>{(answers.interests || []).join(", ")}</p></div>}
                    {answers.joined_class && <div><span className={summaryLabelClass}>{t('onb_summary_class_enrolled')}</span><p className={summaryValueClass}>{answers.joined_class.class_name}</p></div>}
                </div>
            </div>
          );
      }
    }

    function renderUniversitario(step: number) {
        const faculties = [
          { value: "Medicina", key: "onb_faculty_medicina" }, { value: "Ingegneria", key: "onb_faculty_ingegneria" },
          { value: "Economia", key: "onb_faculty_economia" }, { value: "Giurisprudenza", key: "onb_faculty_giurisprudenza" },
          { value: "Lettere", key: "onb_faculty_lettere" }, { value: "Psicologia", key: "onb_faculty_psicologia" },
          { value: "Architettura", key: "onb_faculty_architettura" }, { value: "Scienze", key: "onb_faculty_scienze" },
          { value: "Farmacia", key: "onb_faculty_farmacia" }, { value: "Scienze Politiche", key: "onb_faculty_scienze_pol" },
          { value: "Informatica", key: "onb_faculty_informatica" }, { value: "Matematica", key: "onb_faculty_matematica" },
          { value: "Fisica", key: "onb_faculty_fisica" }, { value: "Chimica", key: "onb_faculty_chimica" },
          { value: "Biologia", key: "onb_faculty_biologia" }, { value: "Altro", key: "onb_faculty_altro" },
        ];
        const uniYears = [
          { value: "1°", key: "onb_uni_year_1" }, { value: "2°", key: "onb_uni_year_2" },
          { value: "3°", key: "onb_uni_year_3" }, { value: "Fuori corso", key: "onb_uni_year_fc" },
          { value: "Magistrale 1°", key: "onb_uni_year_m1" }, { value: "Magistrale 2°", key: "onb_uni_year_m2" },
          { value: "Dottorato", key: "onb_uni_year_phd" },
        ];
        switch (step) {
            case 0:
              return (
                <div className="text-center w-full">
                    <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_welcome')}</h2>
                    <p className="text-muted-foreground mb-8">{t('onb_configure_adult')}</p>
                    <div className="w-24 h-24 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"><BookOpen className="w-12 h-12" /></div>
                </div>
              );
            case 1:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_uni_path')}</h2>
                    <div className="space-y-4">
                       <CityAutocomplete
                         value={answers.uni_citta || ""}
                         onChange={(city) => setAnswers((prev: any) => ({
                           ...prev,
                           uni_citta: city,
                           uni_nome: "",
                           school_name: "",
                           school_code: null,
                         }))}
                         className={inputClass}
                       />
                       <SchoolAutocomplete
                         value={answers.uni_nome || ""}
                         onChange={(name, code, city) => setAnswers((prev: any) => ({
                           ...prev,
                           uni_nome: name,
                           school_name: name,
                           school_code: code,
                           ...(city ? { uni_citta: city } : {}),
                         }))}
                         placeholder={t('onb_uni_name')}
                         className={inputClass}
                         cityFilter={answers.uni_citta || undefined}
                       />
                       <select value={answers.uni_facolta || ""} onChange={e => setAnswers({...answers, uni_facolta: e.target.value})} className={inputClass}>
                          <option value="" disabled>{t('onb_uni_select_faculty')}</option>
                          {faculties.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                       </select>
                       <select value={answers.uni_anno || ""} onChange={e => setAnswers({...answers, uni_anno: e.target.value})} className={inputClass}>
                          <option value="" disabled>{t('onb_uni_select_year')}</option>
                          {uniYears.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                       </select>
                       <input type="text" placeholder={t('onb_uni_course')} value={answers.uni_corso || ""} onChange={e => setAnswers({...answers, uni_corso: e.target.value})} className={inputClass} />
                    </div>
                </div>
              );
            case 2: {
              const tempEsami = answers.uni_esami || [];
              const handleAddEsame = (e: any) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const nm = (form.elements.namedItem("nome") as HTMLInputElement).value;
                  const dt = (form.elements.namedItem("data") as HTMLInputElement).value;
                  if (nm && tempEsami.length < 5) {
                      setAnswers({...answers, uni_esami: [...tempEsami, {nome: nm, data: dt}]});
                      form.reset();
                  }
              };
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_uni_exams')}</h2>
                    <p className="text-muted-foreground text-sm">{t('onb_uni_exams_sub')}</p>
                    <form onSubmit={handleAddEsame} className="flex gap-2">
                        <input name="nome" type="text" placeholder={t('onb_uni_exam_name')} className="flex-1 p-3 rounded-xl border border-border bg-muted/50 outline-none text-sm text-foreground focus:border-primary" required />
                        <input name="data" type="date" className="p-3 rounded-xl border border-border bg-muted/50 outline-none text-sm text-muted-foreground focus:border-primary" />
                        <Button type="submit" disabled={tempEsami.length >= 5} className="rounded-xl">{t('onb_uni_add')}</Button>
                    </form>
                    {tempEsami.map((es: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 border border-border bg-muted/50 rounded-xl">
                            <span className="font-medium text-foreground">{es.nome}</span>
                            <div className="flex items-center gap-3 text-muted-foreground text-sm">
                                <span>{es.data}</span>
                                <button onClick={() => setAnswers({...answers, uni_esami: tempEsami.filter((_:any,idx:number)=>idx!==i)})} className="text-destructive/60 hover:text-destructive">x</button>
                            </div>
                        </div>
                    ))}
                </div>
              );
            }
            case 3:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_uni_study_method')}</h2>
                    <div className="space-y-3">
                       {[
                         { id: "pomodoro", title: t('onb_uni_pomodoro'), sub: t('onb_uni_pomodoro_sub'), icon: Timer },
                         { id: "deep", title: t('onb_uni_deep'), sub: t('onb_uni_deep_sub'), icon: Brain },
                         { id: "misto", title: t('onb_uni_mixed'), sub: t('onb_uni_mixed_sub'), icon: Sliders },
                         { id: "nessuno", title: t('onb_uni_none'), sub: t('onb_uni_none_sub'), icon: Lightbulb }
                       ].map(opt => {
                         const isSel = answers.metodo_studio === opt.id;
                         return <button key={opt.id} onClick={() => setAnswers({...answers, metodo_studio: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? selIconClass : unselIconClass}`}/><div className="text-left"><p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p><p className="text-sm text-muted-foreground">{opt.sub}</p></div></button>
                       })}
                    </div>
                </div>
              );
            case 4:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_uni_ai_needs')}</h2>
                    <p className="text-muted-foreground text-sm">{t('onb_uni_ai_needs_sub')}</p>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: "spiegazione", title: t('onb_uni_ai_explain'), icon: Lightbulb },
                         { id: "ripasso", title: t('onb_uni_ai_review'), icon: ClipboardCheck },
                         { id: "ricerca", title: t('onb_uni_ai_research'), icon: Search },
                         { id: "schemi", title: t('onb_uni_ai_maps'), icon: Network },
                         { id: "orale", title: t('onb_uni_ai_oral'), icon: Mic },
                         { id: "correzione", title: t('onb_uni_ai_paper'), icon: PenLine },
                       ].map(opt => {
                         const isSel = (answers.serve_ai || []).includes(opt.id);
                         return <button key={opt.id} onClick={() => toggleArrayMax("serve_ai", opt.id, 3)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}><opt.icon className={`w-6 h-6 mb-2 ${isSel ? selIconClass : unselIconClass}`}/><span className={`font-medium text-xs text-center ${isSel ? selTextClass : unselTextClass}`}>{opt.title}</span></button>
                       })}
                    </div>
                </div>
              );
            case 5:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_uni_feel_before')}</h2>
                    <div className="space-y-3">
                       {[
                         { id: "ansioso", title: t('onb_uni_feel_anxious') },
                         { id: "procrastino", title: t('onb_uni_feel_procrastinate') },
                         { id: "solo", title: t('onb_uni_feel_social') },
                         { id: "ok", title: t('onb_uni_feel_motivated') },
                       ].map(opt => {
                         const isSel = (answers.sfide_emotive || []).includes(opt.id);
                         return <button key={opt.id} onClick={() => {
                           const arr = answers.sfide_emotive || [];
                           if (arr.includes(opt.id)) setAnswers({...answers, sfide_emotive: arr.filter((x: string) => x !== opt.id)});
                           else if (arr.length < 2) setAnswers({...answers, sfide_emotive: [...arr, opt.id]});
                         }} className={`w-full text-left p-4 rounded-2xl border transition-all ${isSel ? selBtnClass : unselBtnClass}`}>
                           <p className={`font-bold ${isSel ? selTextClass : "text-foreground"}`}>{opt.title}</p>
                         </button>;
                       })}
                    </div>
                </div>
              );
            case 6:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_coach_name')}</h2>
                    <p className="text-muted-foreground text-sm">{t('onb_uni_coach_sub')}</p>
                    <div className="flex justify-center mb-2">
                      <CoachAvatar mood="default" size={80} />
                    </div>
                    <input type="text" placeholder={t('onb_coach_placeholder')} value={answers.coach_name || ""} onChange={e => setAnswers({...answers, coach_name: e.target.value})} className={inputClass} maxLength={20} />
                </div>
              );
            case 7:
              return renderInterestsStep("universitario");
            case 8:
              return (
                <div className="text-left w-full space-y-6">
                    <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_all_set')}</h2>
                    <p className="text-muted-foreground mb-6">{t('onb_uni_profile')}</p>
                    <div className={summaryBoxClass}>
                        <div><span className={summaryLabelClass}>{t('onb_uni_summary_degree')}</span><p className={summaryValueClass}>{answers.uni_anno} {answers.uni_facolta}</p></div>
                        {answers.uni_corso && <div><span className={summaryLabelClass}>{t('onb_uni_summary_course')}</span><p className={summaryValueClass}>{answers.uni_corso}</p></div>}
                        <div><span className={summaryLabelClass}>{t('onb_uni_summary_skills')}</span><p className={summaryValueClass}>{(answers.serve_ai || []).join(", ")}</p></div>
                        <div><span className={summaryLabelClass}>{t('onb_uni_summary_exams')}</span><p className={summaryValueClass}>{(answers.uni_esami || []).length} {t('onb_uni_summary_exams_count')}</p></div>
                        {answers.coach_name && <div><span className={summaryLabelClass}>{t('onb_summary_coach')}</span><p className={summaryValueClass}>{answers.coach_name}</p></div>}
                        {(answers.interests || []).length > 0 && <div><span className={summaryLabelClass}>{t('onb_summary_interests')}</span><p className={summaryValueClass}>{(answers.interests || []).join(", ")}</p></div>}
                    </div>
                </div>
              );
        }
    }

    function renderDocente(step: number) {
        const addCustomMateria = () => {
            const val = (answers._customMateria || "").trim();
            if (!val) return;
            const current = answers.docente_materie || [];
            if (current.length >= 5) return;
            if (current.includes(val)) {
                setAnswers((prev: any) => ({ ...prev, _customMateria: "" }));
                return;
            }
            setAnswers((prev: any) => ({
                ...prev,
                docente_materie: [...(prev.docente_materie || []), val],
                _customMateria: "",
            }));
        };

        const docenteMaterie = ["Matematica","Fisica","Chimica","Italiano","Latino","Greco","Storia","Filosofia","Inglese","Francese","Spagnolo","Tedesco","Informatica","Scienze","Arte","Musica","Educazione Fisica","Educazione Civica","Diritto","Economia","Geografia","Religione","Tecnologia"];
        const orders = [
          { value: "Primaria", key: "onb_order_primaria" },
          { value: "Secondaria I grado", key: "onb_order_sec1" },
          { value: "Secondaria II grado", key: "onb_order_sec2" },
          { value: "Università", key: "onb_order_uni" },
          { value: "Formazione Professionale", key: "onb_order_fp" },
        ];

        switch (step) {
            case 0:
              return (
                <div className="text-center w-full space-y-6">
                    <div className="flex justify-center mb-2">
                      <CoachAvatar mood="default" size={80} />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_doc_welcome')}</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">{t('onb_doc_welcome_sub')}</p>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-border bg-muted/30">
                        <span className="text-2xl mb-2">📚</span>
                        <p className="text-xs font-medium text-foreground">{t('onb_doc_feat_1')}</p>
                      </div>
                      <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-border bg-muted/30">
                        <span className="text-2xl mb-2">👥</span>
                        <p className="text-xs font-medium text-foreground">{t('onb_doc_feat_2')}</p>
                      </div>
                      <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-border bg-muted/30">
                        <span className="text-2xl mb-2">🤝</span>
                        <p className="text-xs font-medium text-foreground">{t('onb_doc_feat_3')}</p>
                      </div>
                    </div>
                </div>
              );
            case 1:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_doc_essentials')}</h2>
                    <div className="space-y-4">
                       <div>
                         <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('onb_doc_gender_label')}</label>
                         <div className="flex gap-3">
                           {[
                             { value: "m", label: t('onb_doc_gender_m') },
                             { value: "f", label: t('onb_doc_gender_f') },
                           ].map(opt => {
                             const isSel = answers.docente_gender === opt.value;
                             return (
                               <button key={opt.value} onClick={() => setAnswers({...answers, docente_gender: opt.value})} className={`flex-1 p-4 rounded-2xl border transition-all text-center font-medium ${isSel ? selBtnClass : unselBtnClass}`}>
                                 {opt.label}
                               </button>
                             );
                           })}
                         </div>
                       </div>
                       <div>
                         <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('onb_doc_school_order')}</label>
                         <select value={answers.docente_ordine || ""} onChange={e => setAnswers({...answers, docente_ordine: e.target.value})} className={inputClass}>
                            <option value="" disabled>{t('onb_doc_select')}</option>
                            {orders.map(a => <option key={a.value} value={a.value}>{t(a.key)}</option>)}
                         </select>
                       </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">{t('onb_doc_subjects')}</p>
                      <div className="flex flex-wrap gap-2">
                        {docenteMaterie.map((m: string) => {
                          const isSel = (answers.docente_materie || []).includes(m);
                          return <button key={m} onClick={() => toggleArrayMax("docente_materie", m, 5)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${isSel ? chipSelClass : chipUnselClass}`}>{t(subjectKey(m))}</button>;
                        })}
                        {(answers.docente_materie || []).filter((m: string) => !docenteMaterie.includes(m)).map((m: string) => (
                          <button key={m} onClick={() => toggleArrayMax("docente_materie", m, 5)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${chipSelClass}`}>{m}</button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <input type="text" placeholder={t('onb_doc_other_subject')} value={answers._customMateria || ""} onChange={e => setAnswers((prev: any) => ({...prev, _customMateria: e.target.value}))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomMateria(); } }} className="flex-1 p-3 rounded-xl border border-border bg-muted/50 outline-none text-sm text-foreground focus:border-primary" />
                        <Button type="button" variant="outline" onClick={() => addCustomMateria()} disabled={(answers.docente_materie || []).length >= 5} className="rounded-xl text-sm">{t('onb_doc_add')}</Button>
                      </div>
                    </div>
                </div>
              );
            case 2:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_doc_school_title')}</h2>
                    <p className="text-muted-foreground text-sm">{t('onb_doc_school_sub')}</p>
                    <SchoolAutocomplete
                      value={answers.school_name || ""}
                      onChange={(name, code, city) => setAnswers((prev: any) => ({
                        ...prev,
                        school_name: name,
                        school_code: code,
                        ...(city ? { docente_citta: city } : {}),
                        teacher_declaration: {
                          ...(prev.teacher_declaration || {}),
                          school_name: name,
                          school_code: code,
                        },
                      }))}
                      placeholder={t('onb_school_name_optional')}
                      className={inputClass}
                    />
                    <input type="text" placeholder={t('onb_doc_city_placeholder')} value={answers.docente_citta || ""} onChange={e => setAnswers({...answers, docente_citta: e.target.value})} className={inputClass} />
                    <button type="button" onClick={handleNext} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                      {t('onb_interests_skip')}
                    </button>
                </div>
              );
            case 3:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">{t('onb_doc_customize')}</h2>
                    <p className="text-muted-foreground text-sm">{t('onb_doc_customize_sub')}</p>
                    <div className="flex justify-center mb-2">
                      <CoachAvatar mood="default" size={80} />
                    </div>
                    <input type="text" placeholder={t('onb_doc_name_placeholder')} value={answers.coach_name || ""} onChange={e => setAnswers({...answers, coach_name: e.target.value})} className={inputClass} maxLength={20} />
                    <p className="text-xs text-muted-foreground text-center">{t('onb_doc_name_change')}</p>
                </div>
              );
            case 4:
              return (
                <div className="text-left w-full space-y-6">
                    <h2 className="text-3xl font-bold text-foreground mb-2">{t('onb_all_set')}</h2>
                    <p className="text-muted-foreground mb-6">{t('onb_doc_ready_sub')}</p>
                    <div className={summaryBoxClass}>
                        <div><span className={summaryLabelClass}>{t('onb_doc_summary_order')}</span><p className={summaryValueClass}>{answers.docente_ordine}</p></div>
                        <div><span className={summaryLabelClass}>{t('onb_doc_summary_subjects')}</span><p className={summaryValueClass}>{(answers.docente_materie || []).join(", ")}</p></div>
                        {answers.school_name && <div><span className={summaryLabelClass}>{t('onb_doc_summary_school')}</span><p className={summaryValueClass}>{answers.school_name}{answers.docente_citta ? ` — ${answers.docente_citta}` : ''}</p></div>}
                        {answers.coach_name && <div><span className={summaryLabelClass}>{t('onb_doc_summary_ai')}</span><p className={summaryValueClass}>{answers.coach_name}</p></div>}
                    </div>
                </div>
              );
        }
    }

    const renderedStepContent =
      role === "medie"
        ? renderMedie(currentStep)
        : role === "superiori"
          ? renderSuperiori(currentStep)
          : role === "universitario"
            ? renderUniversitario(currentStep)
            : role === "docente"
              ? renderDocente(currentStep)
              : null;

    const safeStepContent = renderedStepContent ?? (
      <div className="w-full space-y-6 text-center">
        <p className="text-sm text-muted-foreground">{t('onb_interests_skip_now')}</p>
        <Button type="button" onClick={handleNext} className="rounded-xl">
          {t('onb_next')}
        </Button>
      </div>
    );

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-x-hidden font-sans">
        <div className="absolute top-0 w-full p-6 z-20">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <span className="font-display font-bold text-foreground text-lg">InSchool Onboarding</span>
                <span className="text-sm font-medium text-muted-foreground">Step {currentStep + 1} {t('onb_step_of')} {totalSteps}</span>
            </div>
            <div className="max-w-2xl mx-auto mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>
        </div>

        <div className="flex-1 w-full relative flex items-center justify-center px-4 pt-24 pb-32">
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={currentStep} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
                    className="w-full max-w-2xl absolute flex flex-col items-center justify-center p-8 bg-card rounded-[2rem] shadow-sm border border-border"
                >
                    {safeStepContent}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-md border-t border-border p-6 z-20">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0 || saving} className="text-muted-foreground font-medium hover:bg-muted hover:text-foreground rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-2" /> {t('onb_back')}
                </Button>
                <Button onClick={handleNext} disabled={!canProceed() || saving} className="rounded-xl px-8 font-bold shadow-sm transition-all h-12">
                    {currentStep === totalSteps - 1 ? (saving ? t('onb_saving') : (role === "docente" ? t('onb_doc_enter_dashboard') : t('onb_start'))) : (currentStep === 0 && role === "docente" ? t('onb_doc_start') : t('onb_next'))} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
      </div>
    );
}
