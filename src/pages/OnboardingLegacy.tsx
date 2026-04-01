// MODIFICA: Feature 1 (Avatar), Feature 2 (Coach Name), Feature 3 (Class Dropdown),
// Feature 4 (Subject Logic Inversion), Feature 6 (Access Code Step)
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, BookOpen, Check, Upload, Copy, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createChildProfile, setActiveChildProfileId } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession, clearChildSession, setChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { coachAvatarSrc } from "@/components/shared/CoachAvatarPicker";
import { useToast } from "@/hooks/use-toast";

// MODIFICA: Feature 1 — Avatar imports
import kidBoy1 from "@/assets/avatars/kid-boy-1.png";
import kidGirl1 from "@/assets/avatars/kid-girl-1.png";
import kidBoy2 from "@/assets/avatars/kid-boy-2.png";
import kidGirl2 from "@/assets/avatars/kid-girl-2.png";
import adultMale1 from "@/assets/avatars/adult-male-1.png";
import adultFemale1 from "@/assets/avatars/adult-female-1.png";
import adultMale2 from "@/assets/avatars/adult-male-2.png";
import adultFemale2 from "@/assets/avatars/adult-female-2.png";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// MODIFICA: Feature 1 — Avatar options split by category
const kidAvatars = [
  { id: "kid-boy-1", src: kidBoy1, label: "Ragazzo 1" },
  { id: "kid-girl-1", src: kidGirl1, label: "Ragazza 1" },
  { id: "kid-boy-2", src: kidBoy2, label: "Ragazzo 2" },
  { id: "kid-girl-2", src: kidGirl2, label: "Ragazza 2" },
];

const adultAvatars = [
  { id: "adult-male-1", src: adultMale1, label: "Adulto 1" },
  { id: "adult-female-1", src: adultFemale1, label: "Adulta 1" },
  { id: "adult-male-2", src: adultMale2, label: "Adulto 2" },
  { id: "adult-female-2", src: adultFemale2, label: "Adulta 2" },
];

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
  avatar: string;
  avatarUrl: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  schoolCategory: string; // "primaria" or "media"
  schoolLevel: string;
  favoriteSubjects: string[];
  struggles: string[];
  focusTime: string;
  supportStyles: string[];
  coachName: string;
}

const OnboardingLegacy = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<any>(null);
  const adultSession = getChildSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [data, setData] = useState<OnboardingData & { interests: string[] }>({
    name: "", avatar: "kid-boy-1", avatarUrl: "", age: "", dateOfBirth: "", gender: "",
    schoolCategory: "", schoolLevel: "", favoriteSubjects: [],
    struggles: [], focusTime: "15", supportStyles: [], coachName: "", interests: [],
  });

  // MODIFICA: Feature 2 + Feature 6 — Added coach name step + access code step
  const totalSteps = 10; // 0:info, 1:avatar, 2:school, 3:subjects, 4:struggles, 5:support, 6:coach, 7:interests, 8:focus, 9:access-code
  const toggleInArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const canProceed = () => {
    switch (step) {
      case 0: return data.name.trim() !== "" && data.age !== "" && data.gender !== "";
      case 1: return data.avatar !== "" || data.avatarUrl !== "";
      case 2: return data.schoolLevel !== "";
      case 3: return true;
      case 4: return data.struggles.length > 0;
      case 5: return data.supportStyles.length > 0;
      case 6: return true; // coach name optional
      case 7: return true; // interests optional
      case 8: return true; // focus time
      case 9: return true; // access code
      default: return false;
    }
  };

  // MODIFICA: Feature 1 — Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("profile-avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      setData({ ...data, avatarUrl: urlData.publicUrl, avatar: "custom" });
    } catch (err: any) {
      toast({ title: "Errore nel caricamento", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // MODIFICA: Feature 6 — Copy access code
  const handleCopyCode = () => {
    if (createdProfile?.access_code) {
      navigator.clipboard.writeText(createdProfile.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // MODIFICA: Feature 6 — Send code via email
  const handleSendCodeEmail = async () => {
    toast({ title: "Il codice è stato copiato. Puoi incollarlo in un'email al tuo bambino." });
    handleCopyCode();
  };

  const next = async () => {
    // Create profile at step 8 (focus time), show access code at step 9
    if (step === 8) {
      setSaving(true);
      const allSubjects = subjects;
      const difficultSubjects = allSubjects.filter(s => !data.favoriteSubjects.includes(s));

      const schoolLevel = data.schoolLevel.startsWith("primaria") 
        ? data.schoolLevel.replace("primaria-", "primaria-")
        : data.schoolLevel;

      const profile = await createChildProfile({
        name: data.name,
        avatar_emoji: data.avatar === "custom" ? "custom" : data.avatar,
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
      } as any);

      if (profile) {
        if (data.avatarUrl && data.avatar === "custom") {
          await supabase.from("child_profiles").update({ avatar_emoji: data.avatarUrl } as any).eq("id", profile.id);
        }

        if (data.coachName.trim()) {
          await supabase.from("user_preferences").upsert({
            profile_id: profile.id,
            data: { coach_name: data.coachName.trim() },
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

        setCreatedProfile(profile);
        setSaving(false);
        setStep(9);
      } else {
        setSaving(false);
        toast({ title: "Errore nella creazione del profilo", variant: "destructive" });
      }
      return;
    }

    if (step === 9) {
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
            avatar_emoji: createdProfile.avatar_emoji || data.avatar,
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
          avatarEmoji: data.avatar, schoolLevel: data.schoolLevel,
          favoriteSubjects: data.favoriteSubjects, focusTime: data.focusTime, supportStyles: data.supportStyles,
        }));
      }
      navigate("/dashboard");
      return;
    }

    if (step < totalSteps - 1) {
      if (step === 0) {
        const childAge = parseInt(data.age);
        if (childAge && childAge < 6) return;
      }
      setStep(step + 1);
    }
  };

  // Get the right avatar set based on school category
  const getAvatarSet = () => {
    if (data.schoolCategory === "primaria") return kidAvatars;
    if (data.schoolCategory === "media") return kidAvatars; // Kids use Disney-style
    return adultAvatars; // Fallback for older users
  };

  const getAvatarSrc = (avatarId: string): string => {
    const all = [...kidAvatars, ...adultAvatars];
    return all.find(a => a.id === avatarId)?.src || kidBoy1;
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come si chiama il bambino?</h2><p className="text-muted-foreground">Il coach lo chiamerà per nome.</p></div>
            <div className="space-y-4">
              <input type="text" placeholder="Nome del bambino" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg" />
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

      // MODIFICA: Feature 1 — Avatar selection with Disney-style kids + photo upload
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Scegli un avatar per {data.name}</h2>
              <p className="text-muted-foreground">Puoi anche caricare una foto dal tuo dispositivo.</p>
            </div>

            {/* Photo upload */}
            <div className="flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className={`w-24 h-24 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
                  data.avatar === "custom" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {data.avatarUrl ? (
                  <img src={data.avatarUrl} alt="Foto profilo" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Carica foto</span>
                  </>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>

            <p className="text-center text-xs text-muted-foreground">oppure scegli un avatar</p>

            {/* Avatar grid */}
            <div className="grid grid-cols-4 gap-3">
              {kidAvatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setData({ ...data, avatar: avatar.id, avatarUrl: "" })}
                  className={`p-2 rounded-2xl border-2 transition-all ${
                    data.avatar === avatar.id && !data.avatarUrl
                      ? "border-primary bg-primary/5 shadow-soft"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <img src={avatar.src} alt={avatar.label} className="w-full h-full rounded-xl object-cover" loading="lazy" width={512} height={512} />
                </button>
              ))}
            </div>
          </div>
        );

      // MODIFICA: Feature 3 — Dropdown for class selection (Primaria 1-5, Media 1-3)
      case 2:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Che classe fa {data.name}?</h2></div>
            
            {/* School category selection */}
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

            {/* Class dropdown */}
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
          </div>
        );

      // MODIFICA: Feature 4 — Inverted subject logic: checked = va bene, unchecked = difficile
      case 3:
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

      case 4:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Cosa succede quando studia?</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {struggles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, struggles: toggleInArray(data.struggles, s.id) })} className={`text-left px-4 py-4 rounded-2xl border transition-all ${data.struggles.includes(s.id) ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="font-medium text-foreground text-sm">{s.label}</span></button>))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div><h2 className="font-display text-2xl font-bold text-foreground mb-2">Come deve aiutarlo il coach?</h2></div>
            <div className="space-y-3">
              {supportStyles.map((s) => (<button key={s.id} onClick={() => setData({ ...data, supportStyles: toggleInArray(data.supportStyles, s.id) })} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${data.supportStyles.includes(s.id) ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:bg-muted"}`}><span className="font-medium text-foreground">{s.label}</span></button>))}
            </div>
          </div>
        );

      // MODIFICA: Feature 2 — Coach name customization step
      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Come si chiama il coach di {data.name}?</h2>
              <p className="text-muted-foreground text-sm">Dai un nome al coach AI. Potrai cambiarlo dopo nelle impostazioni.</p>
            </div>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10">
                <img src={coachAvatarSrc} alt="Coach" className="w-full h-full object-cover" width={80} height={80} />
              </div>
            </div>
            <input
              type="text"
              placeholder="Es. Luna, Gufo, Buddy..."
              value={data.coachName}
              onChange={(e) => setData({ ...data, coachName: e.target.value })}
              maxLength={20}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-lg text-center"
            />
            <p className="text-xs text-muted-foreground text-center">Puoi saltare questo step e scegliere il nome dopo.</p>
          </div>
        );

      // Interests step
      case 7: {
        const selected = data.interests;
        const [customVal, setCustomVal] = useState("");
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
              <input type="text" value={customVal} onChange={e => setCustomVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customVal.trim() && selected.length < 10 && !selected.includes(customVal.trim())) {
                    setData({ ...data, interests: [...selected, customVal.trim()] });
                    setCustomVal("");
                  }
                }}
                placeholder="Aggiungi altri interessi..."
                maxLength={30}
                className="flex-1 px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            {selected.length > 0 && <p className="text-xs text-muted-foreground">{selected.length}/10 selezionati</p>}
            <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">Salta</button>
          </div>
        );
      }

      case 8:
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

      case 9:
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Profilo di {data.name} creato!</h2>
              <p className="text-muted-foreground text-sm">Ecco il codice di accesso univoco per {data.name}. Usalo per farlo entrare nella sua area personale.</p>
            </div>

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
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => step > 0 && step !== 8 ? setStep(step - 1) : step === 0 ? navigate("/profiles") : null} disabled={step === 8} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>
          <Button onClick={next} disabled={!canProceed() || saving} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl px-6 disabled:opacity-40">
            {step === 8 ? "Vai alla dashboard" : step === 7 ? (saving ? "Salvataggio..." : "Crea profilo!") : "Avanti"}<ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingLegacy;
