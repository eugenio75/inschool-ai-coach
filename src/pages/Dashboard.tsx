import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getActiveChildProfileId, getChildProfile } from "@/lib/database";
import { getChildSession, isChildSession, setChildSession } from "@/lib/childSession";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import DashboardAlunno from "./DashboardAlunno";
import DashboardMedie from "./DashboardMedie";
import DashboardSuperiori from "./DashboardSuperiori";
import DashboardUniversitario from "./DashboardUniversitario";
import DashboardDocente from "./DashboardDocente";

const ADULT_ROLES = ["medie", "superiori", "universitario", "docente"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [user]);

  async function load() {
    setLoading(true);

    // 1. Sessione bambino (codice magico)
    if (isChildSession()) {
      const s = getChildSession();
      if (s?.profile) { setRole(s.profile.school_level); setLoading(false); return; }
    }

    // 2. Adulto con sessione attiva in localStorage
    const profileId = getActiveChildProfileId();
    if (profileId) {
      const p = await getChildProfile(profileId);
      if (p) { setRole(p.school_level); setLoading(false); return; }
    }

    // 3. Bug #5 fix — adulto dopo refresh senza sessione localStorage:
    //    ricostruisce la sessione leggendo child_profiles da Supabase
    if (user) {
      const { data: adultProfile } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("parent_id", user.id)
        .in("school_level", ADULT_ROLES)
        .maybeSingle();

      if (adultProfile) {
        setChildSession({
          profileId: adultProfile.id,
          accessCode: adultProfile.access_code || "",
          profile: adultProfile as any,
        });
        setRole(adultProfile.school_level);
        setLoading(false);
        return;
      }
    }

    // 4. Nessun profilo trovato → ProfileSelector
    navigate("/profiles");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === "medie") return <DashboardMedie />;
  if (role === "superiori") return <DashboardSuperiori />;
  if (role === "universitario") return <DashboardUniversitario />;
  if (role === "docente") return <DashboardDocente />;

  return <DashboardAlunno />;
}
