import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Lock, Loader2, Users, Shield, Pencil, Bell,
  Eye, EyeOff, Trash2, RotateCcw, Moon, Brain, BookOpen, Link2, Users2, Building, Plus,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { getChildProfiles, getParentSettings, updateParentPin, updateChildProfile } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { getChildSession, setChildSession } from "@/lib/childSession";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CoachAvatar } from "@/components/shared/CoachAvatar";
import { BlockchainTab } from "@/components/BlockchainTab";
import { MyClassesSection } from "@/components/MyClassesSection";

// Avatar colors for profile customization
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };
  const strength = getStrength();
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const labels = ["Debole", "Sufficiente", "Buona", "Forte"];
  if (!password) return null;
  return (
    <div className="space-y-1 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? colors[strength - 1] : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[strength - 1] || "Troppo corta"}</p>
    </div>
  );
}

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [parentPin, setParentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showPinEdit, setShowPinEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  // Change password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Delete account
  const [showDelete1, setShowDelete1] = useState(false);
  const [showDelete2, setShowDelete2] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Notifications
  const [notifTimer, setNotifTimer] = useState(false);

  // Library toggle per child profile
  const [libraryFlags, setLibraryFlags] = useState<Record<string, boolean>>({});

  // Coach customization
  const [coachNameSetting, setCoachNameSetting] = useState("");
  const [savingCoach, setSavingCoach] = useState(false);

  // Docente materie editing
  const [docenteMaterie, setDocenteMaterie] = useState<string[]>([]);
  const [newMateria, setNewMateria] = useState("");
  const [savingMaterie, setSavingMaterie] = useState(false);

  // Docente discoverability
  const [discoverable, setDiscoverable] = useState(false);
  const [teacherBadge, setTeacherBadge] = useState<string>("unverified");
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);

  // Check if adult role
  const session = getChildSession();
  const isAdult = ["superiori", "universitario", "docente"].includes(session?.profile?.school_level || "");

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const p = await getChildProfiles();
      setProfiles(p);
      const settings = await getParentSettings();
      if (settings) setParentPin(settings.parent_pin || "0000");
      if ("Notification" in window) {
        setNotifTimer(Notification.permission === "granted");
      }

      // Load library flags for each child profile (alunno only)
      const alunni = p.filter((pr: any) => pr.school_level === "alunno");
      if (alunni.length > 0) {
        const flags: Record<string, boolean> = {};
        for (const a of alunni) {
          const { data } = await supabase
            .from("user_preferences")
            .select("data")
            .eq("profile_id", a.id)
            .maybeSingle();
          const prefs = (data?.data as any) || {};
          flags[a.id] = !!prefs.show_library;
        }
        setLibraryFlags(flags);
      }

      // Load coach prefs
      const profileId = session?.profileId;
      if (profileId) {
        const { data: prefData } = await supabase
          .from("user_preferences")
          .select("data")
          .eq("profile_id", profileId)
          .maybeSingle();
        const prefs = (prefData?.data as any) || {};
        if (prefs.coach_name) setCoachNameSetting(prefs.coach_name);
      }

      // Load docente materie from profile
      if (session?.profile?.school_level === "docente") {
        setDocenteMaterie(session.profile.favorite_subjects || []);
        // Load discoverability
        if (profileId) {
          const { data: prefData2 } = await supabase
            .from("user_preferences")
            .select("data")
            .eq("profile_id", profileId)
            .maybeSingle();
          const prefs2 = (prefData2?.data as any) || {};
          setDiscoverable(!!prefs2.discoverable);
          // Determine badge
          if (prefs2.email_istituzionale_verified) {
            setTeacherBadge("verified");
          } else if (prefs2.teacher_declaration?.school_code) {
            setTeacherBadge("school_recognized");
          } else {
            setTeacherBadge("unverified");
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const handlePinSave = async () => {
    if (newPin.length === 4 && /^\d{4}$/.test(newPin)) {
      await updateParentPin(newPin);
      setParentPin(newPin);
      setShowPinEdit(false);
      setNewPin("");
      toast.success("PIN aggiornato!");
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast.error("Le password non coincidono.");
      return;
    }
    if (newPw.length < 6) {
      toast.error("La password deve essere almeno 6 caratteri.");
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    if (error) {
      toast.error(error.message || "Errore nell'aggiornamento della password.");
    } else {
      toast.success("Password aggiornata con successo!");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  };

  const handleResetOnboarding = async () => {
    if (!session?.profileId) return;
    await supabase.from("child_profiles").update({ onboarding_completed: false } as any).eq("id", session.profileId);
    toast.success("Onboarding reimpostato. Verrai reindirizzato.");
    navigate("/onboarding");
  };
  const handleSaveCoach = async () => {
    if (!session?.profileId) return;
    setSavingCoach(true);
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id, data")
      .eq("profile_id", session.profileId)
      .maybeSingle();
    const newData = { ...((existing?.data as any) || {}), coach_name: coachNameSetting };
    if (existing) {
      await supabase.from("user_preferences").update({ data: newData } as any).eq("id", existing.id);
    } else {
      await supabase.from("user_preferences").insert({ profile_id: session.profileId, data: newData } as any);
    }
    setSavingCoach(false);
    toast.success("Coach aggiornato!");
  };

  const handleNotifToggle = async (checked: boolean) => {
    if (checked && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifTimer(perm === "granted");
    } else {
      setNotifTimer(false);
    }
  };

  const handleSaveMaterie = async (materie: string[]) => {
    if (!session?.profileId) return;
    setSavingMaterie(true);
    await supabase.from("child_profiles").update({ favorite_subjects: materie } as any).eq("id", session.profileId);
    const currentSession = getChildSession();
    if (currentSession?.profile) {
      setChildSession({
        ...currentSession,
        profile: { ...currentSession.profile, favorite_subjects: materie } as any,
      });
    }
    setDocenteMaterie(materie);
    setSavingMaterie(false);
    toast.success("Materie aggiornate!");
  };

  const handleAddMateria = () => {
    const val = newMateria.trim();
    if (!val || docenteMaterie.includes(val)) { setNewMateria(""); return; }
    handleSaveMaterie([...docenteMaterie, val]);
    setNewMateria("");
  };

  const handleRemoveMateria = (m: string) => {
    handleSaveMaterie(docenteMaterie.filter(x => x !== m));
  };

  const handleToggleLibrary = async (profileId: string, checked: boolean) => {
    setLibraryFlags(prev => ({ ...prev, [profileId]: checked }));
    // Upsert user_preferences.data.show_library
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id, data")
      .eq("profile_id", profileId)
      .maybeSingle();

    const newData = { ...((existing?.data as any) || {}), show_library: checked };

    if (existing) {
      await supabase.from("user_preferences").update({ data: newData } as any).eq("id", existing.id);
    } else {
      await supabase.from("user_preferences").insert({ profile_id: profileId, data: newData } as any);
    }
    toast.success(checked ? "Libreria attivata" : "Libreria disattivata");
  };

  const handleDeleteAccount = async () => {
    if (!user?.email || deleteConfirmText !== user.email) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { action: "delete_account" },
      });
      if (error) throw error;
      localStorage.removeItem("inschool-child-session");
      localStorage.removeItem("inschool-active-child-id");
      localStorage.removeItem("inschool-profile");
      await supabase.auth.signOut();
      navigate("/");
    } catch (e: any) {
      toast.error(t("delete_account_error"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
              <span className="font-display text-lg font-semibold text-foreground">Impostazioni</span>
            </div>
            <LogoutButton showLabel />
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Account info */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Account</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {isAdult && session?.profile?.school_level && (
              <span className="inline-block mt-2 text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full capitalize">
                {session.profile.school_level}
              </span>
            )}
          </div>

          {/* Change Password */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Cambia Password</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nuova password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Nuova password"
                    className="rounded-xl pr-10"
                  />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={newPw} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Conferma password</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Ripeti la nuova password"
                  className="rounded-xl mt-1"
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-destructive mt-1">Le password non coincidono</p>
                )}
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={!newPw || newPw !== confirmPw || newPw.length < 6 || changingPw}
                className="rounded-xl"
              >
                {changingPw ? "Aggiornamento..." : "Aggiorna password"}
              </Button>
            </div>
          </div>

          {/* Child profiles (only for parents) */}
          {!isAdult && profiles.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Profili figli ({profiles.length})</h3>
              <div className="space-y-3">
                {profiles.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={p.name || "U"} size="md" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.age ? `${p.age} anni` : ""} {p.school_level ? `· ${p.school_level}` : ""}</p>
                      </div>
                    </div>
                    {p.school_level === "alunno" && (
                      <div className="flex items-center justify-between pl-11">
                        <div>
                          <p className="text-xs font-medium text-foreground">Libreria materiali</p>
                          <p className="text-[10px] text-muted-foreground">Mostra la Libreria nella dashboard</p>
                        </div>
                        <Switch
                          checked={!!libraryFlags[p.id]}
                          onCheckedChange={(checked) => handleToggleLibrary(p.id, checked)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => navigate("/onboarding")} className="w-full mt-4 rounded-2xl border-border">
                Aggiungi figlio
              </Button>
            </div>
          )}

          {/* Parent PIN (only for parents) */}
          {!isAdult && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-destructive" /> PIN Area Genitori</h3>
              <p className="text-sm text-muted-foreground mb-3">Il PIN protegge l'accesso alla dashboard genitori. PIN attuale: {parentPin}</p>
              {!showPinEdit ? (
                <Button variant="outline" onClick={() => setShowPinEdit(true)} className="rounded-xl border-border">Cambia PIN</Button>
              ) : (
                <div className="flex gap-2">
                  <Input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Nuovo PIN (4 cifre)" maxLength={4} className="flex-1 rounded-xl text-center text-lg tracking-widest font-mono" />
                  <Button onClick={handlePinSave} disabled={newPin.length !== 4} className="rounded-xl">Salva</Button>
                </div>
              )}
            </div>
          )}

          {/* Coach Customization */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Il tuo Coach AI</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <CoachAvatar mood="default" size={48} />
                <div>
                  <p className="font-medium text-foreground">{coachNameSetting || "Coach AI"}</p>
                  <p className="text-xs text-muted-foreground">Il tuo assistente personale</p>
                </div>
              </div>
              <Input
                type="text"
                placeholder="Nome del coach..."
                value={coachNameSetting}
                onChange={(e) => setCoachNameSetting(e.target.value)}
                maxLength={20}
                className="rounded-xl"
              />
              <Button onClick={handleSaveCoach} disabled={savingCoach} className="rounded-xl w-full">
                {savingCoach ? "Salvataggio..." : "Salva nome coach"}
              </Button>
            </div>
          </div>

          {/* Materie docente (editable) */}
          {session?.profile?.school_level === "docente" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Le tue materie</h3>
              {docenteMaterie.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {docenteMaterie.map((m: string) => (
                    <span key={m} className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                      {m}
                      <button onClick={() => handleRemoveMateria(m)} className="hover:text-destructive transition-colors" disabled={savingMaterie}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">Nessuna materia configurata.</p>
              )}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Aggiungi materia..."
                  value={newMateria}
                  onChange={(e) => setNewMateria(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMateria()}
                  className="rounded-xl flex-1"
                  maxLength={30}
                />
                <Button onClick={handleAddMateria} disabled={!newMateria.trim() || savingMaterie} className="rounded-xl" size="sm">
                  {savingMaterie ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aggiungi"}
                </Button>
              </div>
            </div>
          )}

          {/* Teacher Discoverability */}
          {session?.profile?.school_level === "docente" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users2 className="w-4 h-4 text-primary" /> Visibilità studenti
              </h3>
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Rendi il mio profilo visibile agli studenti della mia scuola</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Gli studenti della tua scuola potranno trovarti durante la registrazione</p>
                </div>
                <Switch
                  checked={discoverable}
                  disabled={savingDiscoverable}
                  onCheckedChange={async (checked) => {
                    setSavingDiscoverable(true);
                    setDiscoverable(checked);
                    const pid = session?.profileId;
                    if (pid) {
                      const { data: existing } = await supabase
                        .from("user_preferences")
                        .select("id, data")
                        .eq("profile_id", pid)
                        .maybeSingle();
                      const newData = { ...((existing?.data as any) || {}), discoverable: checked };
                      if (existing) {
                        await supabase.from("user_preferences").update({ data: newData } as any).eq("id", existing.id);
                      } else {
                        await supabase.from("user_preferences").insert({ profile_id: pid, data: newData } as any);
                      }
                    }
                    setSavingDiscoverable(false);
                    toast.success(checked ? "Profilo visibile agli studenti" : "Profilo nascosto");
                  }}
                />
              </div>
              {discoverable && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
                  <span className="text-sm">
                    {teacherBadge === "verified" ? "🔵" : teacherBadge === "school_recognized" ? "🟡" : "⚪"}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {teacherBadge === "verified" ? "Docente Verificato" : teacherBadge === "school_recognized" ? "Istituto Riconosciuto" : "Non verificato"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* My Classes (for non-docente students) */}
          {isAdult && session?.profile?.school_level !== "docente" && session?.profileId && (
            <MyClassesSection profileId={session.profileId} />
          )}

          {/* Study preferences reset (non-docente adult) */}
          {isAdult && session?.profile?.school_level !== "docente" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><RotateCcw className="w-4 h-4 text-primary" /> Preferenze Studio</h3>
              <p className="text-sm text-muted-foreground mb-3">Riconfigura le tue preferenze di studio e materie dall'onboarding.</p>
              <Button variant="outline" className="rounded-xl" onClick={handleResetOnboarding}>
                Reimposta onboarding
              </Button>
            </div>
          )}

          {/* Notifications (hide timer for docente) */}
          {session?.profile?.school_level !== "docente" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Notifiche</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Notifiche browser per fine timer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ricevi una notifica quando il timer di studio termina</p>
                </div>
                <Switch checked={notifTimer} onCheckedChange={handleNotifToggle} />
              </div>
            </div>
          )}

          {/* Aspetto */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Moon className="w-4 h-4 text-primary" /> Aspetto</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tema scuro</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cambia tra tema chiaro e scuro</p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="space-y-3">
            {!isAdult && (
              <Button variant="outline" onClick={() => navigate("/parent-dashboard")} className="w-full rounded-2xl border-border text-foreground">Area genitori</Button>
            )}
            <LogoutButton showLabel className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border text-foreground hover:text-destructive hover:bg-destructive/5 transition-colors py-3 text-sm font-medium" />
          </div>

          {/* Blockchain */}
          {user && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" /> Blockchain
              </h3>
              <BlockchainTab userId={user.id} />
            </div>
          )}

          {/* Delete account — danger zone */}
          <div className="bg-card rounded-2xl border border-destructive/30 p-6 shadow-soft">
            <h3 className="font-display font-semibold text-destructive mb-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> {t("delete_account_title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("delete_account_desc")}
            </p>
            <Button variant="outline" className="rounded-xl border-destructive text-destructive hover:bg-destructive/5" onClick={() => setShowDelete1(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> {t("delete_account_button")}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete step 1 */}
      <AlertDialog open={showDelete1} onOpenChange={setShowDelete1}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_account_step1_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_account_step1_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setShowDelete1(false); setShowDelete2(true); }}
            >
              {t("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete step 2 — type email to confirm */}
      <AlertDialog open={showDelete2} onOpenChange={setShowDelete2}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_account_step2_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_account_step2_desc").replace("{email}", user?.email || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder={user?.email || ""}
            className="rounded-xl text-center"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={() => setDeleteConfirmText("")}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirmText !== user?.email || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("delete_permanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
