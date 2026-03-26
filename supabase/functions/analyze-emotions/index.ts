import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { childProfileId, accessCode } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate access
    if (accessCode) {
      const { data: profile } = await supabase
        .from("child_profiles")
        .select("id, access_code")
        .eq("id", childProfileId)
        .eq("access_code", accessCode.toUpperCase().trim())
        .maybeSingle();
      if (!profile) {
        return new Response(JSON.stringify({ error: "Non autorizzato" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get child profile to determine school_level
    const { data: childProfile } = await supabase
      .from("child_profiles")
      .select("school_level, age")
      .eq("id", childProfileId)
      .single();

    const schoolLevel = childProfile?.school_level || "alunno";
    const isJunior = schoolLevel === "alunno" || schoolLevel === "medie";

    // Fetch last 30 days of check-ins
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const { data: checkins } = await supabase
      .from("emotional_checkins")
      .select("*")
      .eq("child_profile_id", childProfileId)
      .gte("checkin_date", thirtyDaysAgo)
      .order("checkin_date", { ascending: false });

    if (!checkins || checkins.length < 3) {
      return new Response(JSON.stringify({ analyzed: false, reason: "insufficient_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze patterns
    const last7 = checkins.filter((c: any) => {
      const d = new Date(c.checkin_date);
      return d >= new Date(Date.now() - 7 * 86400000);
    });
    const last14 = checkins.filter((c: any) => {
      const d = new Date(c.checkin_date);
      return d >= new Date(Date.now() - 14 * 86400000);
    });

    const countSignals = (items: any[]) => {
      const signals: Record<string, number> = {};
      for (const item of items) {
        for (const signal of (item.signals || [])) {
          signals[signal] = (signals[signal] || 0) + 1;
        }
      }
      return signals;
    };

    const countTones = (items: any[]) => {
      const tones: Record<string, number> = { positive: 0, neutral: 0, low: 0 };
      for (const item of items) {
        tones[item.emotional_tone || "neutral"]++;
      }
      return tones;
    };

    const countEnergy = (items: any[]) => {
      const energy: Record<string, number> = { high: 0, medium: 0, low: 0 };
      for (const item of items) {
        energy[item.energy_level || "medium"]++;
      }
      return energy;
    };

    const signals7 = countSignals(last7);
    const signals14 = countSignals(last14);
    const signals30 = countSignals(checkins);
    const tones7 = countTones(last7);
    const energy7 = countEnergy(last7);
    const tones14 = countTones(last14);
    const energy14 = countEnergy(last14);

    // Calculate consecutive low mood days (mood_streak)
    let moodStreak = 0;
    const sortedByDate = [...checkins].sort((a: any, b: any) => 
      new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime()
    );
    for (const c of sortedByDate) {
      if ((c as any).emotional_tone === "low" || (c as any).energy_level === "low") {
        moodStreak++;
      } else {
        break;
      }
    }

    // Update mood_streak in user_preferences
    await supabase
      .from("user_preferences")
      .update({ mood_streak: moodStreak })
      .eq("profile_id", childProfileId);

    // Determine alert level
    let alertLevel: string | null = null;
    let alertTitle = "";
    let alertMessage = "";
    const patternData: Record<string, any> = {
      last7: { tones: tones7, energy: energy7, signals: signals7, count: last7.length },
      last14: { tones: tones14, energy: energy14, signals: signals14, count: last14.length },
      last30: { tones: countTones(checkins), energy: countEnergy(checkins), signals: signals30, count: checkins.length },
      moodStreak,
    };

    // Check for text-based urgent signals
    const recentTexts = checkins.slice(0, 5).flatMap((c: any) => {
      const responses = c.responses || [];
      return responses
        .filter((r: any) => r.answerId === "free_text" && r.answer)
        .map((r: any) => r.answer.toLowerCase());
    });

    const urgentPhrases = [
      "vorrei sparire", "non ce la faccio più", "mi faccio del male",
      "farmi del male", "non voglio più vivere", "voglio morire",
    ];
    const concernPhrases = [
      "non voglio fare niente", "sono sempre solo", "sono sempre sola",
      "tanto non cambia niente", "non mi importa più", "nessuno mi capisce",
    ];

    const hasUrgentText = recentTexts.some((t: string) =>
      urgentPhrases.some(p => t.includes(p))
    );
    const hasConcernText = recentTexts.some((t: string) =>
      concernPhrases.some(p => t.includes(p))
    );

    // URGENT
    if (hasUrgentText) {
      alertLevel = "urgent";
      alertTitle = "Segnale critico rilevato";
      alertMessage = "Lo studente ha espresso frasi che richiedono attenzione immediata. È importante parlare con il bambino con calma e valutare se coinvolgere un professionista.";
    }
    // CONCERN — 7+ days low mood or concern phrases
    else if (moodStreak >= 7 || hasConcernText) {
      alertLevel = "concern";
      alertTitle = "Segnali di disagio prolungato";
      alertMessage = `Lo studente mostra segnali di disagio da ${moodStreak} giorni consecutivi. Non si tratta di una diagnosi, ma potrebbe essere utile parlare con il bambino per capire come si sente.`;
    }
    // WATCH — 3-4 consecutive low mood days
    else if (moodStreak >= 3) {
      alertLevel = "watch";
      alertTitle = "Alcuni giorni di umore basso";
      alertMessage = "Lo studente ha mostrato umore basso per alcuni giorni consecutivi. Vale la pena prestare attenzione e offrire supporto.";
    }
    // HIGH: persistent distress over 14+ days (legacy)
    else if (
      (signals14.distress_combined && signals14.distress_combined >= 3) ||
      (signals14.anxiety && signals14.anxiety >= 4) ||
      (tones14.low >= Math.ceil(last14.length * 0.6) && last14.length >= 5)
    ) {
      alertLevel = "high";
      alertTitle = "Segnali di disagio persistente";
      alertMessage = "Nelle ultime due settimane abbiamo notato segnali ripetuti di stanchezza, agitazione o difficoltà. Potrebbe essere utile parlare con il bambino per capire come si sente.";
    }
    // MEDIUM
    else if (
      (signals7.difficulty_reported && signals7.difficulty_reported >= 3) ||
      (signals7.anxiety && signals7.anxiety >= 2) ||
      (tones7.low >= Math.ceil(last7.length * 0.5) && last7.length >= 4)
    ) {
      alertLevel = "medium";
      alertTitle = "Alcuni segnali di fatica";
      alertMessage = "Negli ultimi giorni il bambino ha mostrato segni di fatica più frequenti del solito.";
    }
    // LOW
    else if (
      (energy7.low >= Math.ceil(last7.length * 0.4) && last7.length >= 3) ||
      (signals7.low_energy && signals7.low_energy >= 2)
    ) {
      alertLevel = "low";
      alertTitle = "Energia un po' bassa";
      alertMessage = "Il bambino ha segnalato di sentirsi stanco o con poca energia in alcuni degli ultimi giorni.";
    }

    // Save alert if detected
    if (alertLevel) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: existingAlerts } = await supabase
        .from("emotional_alerts")
        .select("id, alert_level")
        .eq("child_profile_id", childProfileId)
        .eq("alert_level", alertLevel)
        .gte("created_at", weekAgo);

      if (!existingAlerts || existingAlerts.length === 0) {
        await supabase.from("emotional_alerts").insert({
          child_profile_id: childProfileId,
          alert_level: alertLevel,
          title: alertTitle,
          message: alertMessage,
          pattern_data: patternData,
        });
      }
    }

    // ─── FIX 3: Active parent notification for URGENT/CONCERN junior ───
    if (isJunior && (alertLevel === "urgent" || alertLevel === "concern")) {
      // Check: no notification in last 48h for this level
      const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();
      const { data: recentNotifs } = await supabase
        .from("parent_notifications")
        .select("id")
        .eq("child_profile_id", childProfileId)
        .eq("alert_level", alertLevel)
        .gte("created_at", twoDaysAgo);

      if (!recentNotifs || recentNotifs.length === 0) {
        const notifTitle = alertLevel === "urgent"
          ? "Un segnale importante"
          : "Un po' di attenzione in più";
        
        const notifMessage = alertLevel === "urgent"
          ? "InSchool ha rilevato alcuni segnali che potrebbero indicare un momento difficile per tuo figlio. Ti invitiamo a dedicargli qualche momento di attenzione oggi. Non è un'emergenza — è un segnale preventivo."
          : "Negli ultimi giorni tuo figlio sembra attraversare un momento un po' pesante. Un po' di attenzione in più può fare la differenza.";

        await supabase.from("parent_notifications").insert({
          child_profile_id: childProfileId,
          alert_level: alertLevel,
          title: notifTitle,
          message: notifMessage,
          link_url: "/parent",
        });
      }
    }

    return new Response(JSON.stringify({
      analyzed: true,
      alertLevel,
      moodStreak,
      patterns: patternData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-emotions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
