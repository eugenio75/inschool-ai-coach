import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Lock, Loader2, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildProfiles, getParentSettings, updateParentPin } from "@/lib/database";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [parentPin, setParentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showPinEdit, setShowPinEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const p = await getChildProfiles();
      setProfiles(p);
      const settings = await getParentSettings();
      if (settings) setParentPin(settings.parent_pin || "0000");
      setLoading(false);
    };
    load();
  }, []);

  const handlePinSave = async () => {
    if (newPin.length === 4 && /^\d{4}$/.test(newPin)) {
      await updateParentPin(newPin);
      setParentPin(newPin);
      setShowPinEdit(false);
      setNewPin("");
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/profiles")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <span className="font-display text-lg font-semibold text-foreground">Impostazioni Famiglia</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Account info */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-sage-dark" /> Account genitore</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          {/* Child profiles */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-clay-dark" /> Profili figli ({profiles.length})</h3>
            <div className="space-y-3">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <span className="text-2xl">{p.avatar_emoji || "🧒"}</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.age ? `${p.age} anni` : ""} {p.school_level ? `• ${p.school_level}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => navigate("/onboarding")} className="w-full mt-4 rounded-2xl border-border">
              Aggiungi figlio
            </Button>
          </div>

          {/* Parent PIN */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-terracotta" /> PIN Area Genitori</h3>
            <p className="text-sm text-muted-foreground mb-3">Il PIN protegge l'accesso alla dashboard genitori. PIN attuale: {parentPin}</p>
            {!showPinEdit ? (
              <Button variant="outline" onClick={() => setShowPinEdit(true)} className="rounded-xl border-border">Cambia PIN</Button>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Nuovo PIN (4 cifre)" maxLength={4} className="flex-1 px-4 py-2 rounded-xl border border-border bg-muted text-foreground text-center text-lg tracking-widest font-mono" />
                <Button onClick={handlePinSave} disabled={newPin.length !== 4} className="bg-primary text-primary-foreground rounded-xl">Salva</Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <Button variant="outline" onClick={() => navigate("/parent-dashboard")} className="w-full rounded-2xl border-border text-foreground">Area genitori</Button>
            <Button variant="outline" onClick={async () => { await signOut(); navigate("/"); }} className="w-full rounded-2xl border-destructive text-destructive">Esci dall'account</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
