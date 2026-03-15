import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("inschool-profile");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch {}
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Profilo</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {profile && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center">
                  <span className="font-display text-2xl font-bold text-sage-dark">
                    {profile.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">{profile.name}</h2>
                  <p className="text-sm text-muted-foreground">{profile.age} anni • {profile.schoolLevel}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Materie preferite</span>
                  <span className="text-foreground font-medium">{profile.favoriteSubjects?.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Tempo di focus</span>
                  <span className="text-foreground font-medium">{profile.focusTime} minuti</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Stile di supporto</span>
                  <span className="text-foreground font-medium capitalize">{profile.supportStyle || "—"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => navigate("/onboarding")}
              className="w-full rounded-2xl border-border text-foreground"
            >
              Modifica profilo
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/parent-dashboard")}
              className="w-full rounded-2xl border-border text-foreground"
            >
              Area genitori
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
