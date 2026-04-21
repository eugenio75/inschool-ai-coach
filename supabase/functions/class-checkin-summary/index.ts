// Class check-in summary: per-student snapshot across last 7 days.
// Crosses emotional signals (mood_streak) + academic data (assignment_results).
// Returns 3 categories: nella_norma 🟢 / da_tenere_docchio 🟡 / attenzione 🔴.
// CTAs only for 🔴 students (open profile + generate recovery).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TECHNICAL_KEYS = new Set([
  "common_errors", "errors", "error", "summary", "score", "metric",
  "rate", "percent", "percentage", "total", "count", "n/a", "na", "null",
  "undefined", "unknown", "generic",
]);
const isTechnicalKey = (k: string) => {
  const low = k.trim().toLowerCase();
  if (!low) return true;
  if (TECHNICAL_KEYS.has(low)) return true;
  if (/^[0-9_\-:.]+$/.test(low)) return true;
  return false;
};

// Map mood_streak (consecutive negative check-ins) → distress level 0-4
function streakToLevel(streak: number): number {
  if (streak <= 0) return 0;
  if (streak <= 2) return 1;
  if (streak <= 4) return 2;
  if (streak <= 6) return 3;
  return 4;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { classId } = await req.json();
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId mancante" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Class context
    const { data: classe } = await sb.from("classi").select("nome, materia").eq("id", classId).maybeSingle();
    const className = classe?.nome || "la classe";

    // Enrolled students
    const { data: enrollments } = await sb
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("status", "active");
    const studentParentIds = (enrollments || []).map((e: any) => e.student_id);

    if (studentParentIds.length === 0) {
      return new Response(JSON.stringify({
        generato_il: new Date().toISOString().slice(0, 10),
        periodo: "ultimi 7 giorni",
        classe: className,
        riepilogo: { nella_norma: 0, da_tenere_docchio: 0, attenzione: 0 },
        studenti: [],
        nota: "Nessuno studente iscritto alla classe.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Profiles (only those with consent)
    const { data: profiles } = await sb
      .from("child_profiles")
      .select("id, parent_id, name, last_name, teacher_insights_consent")
      .in("parent_id", studentParentIds)
      .eq("teacher_insights_consent", true);

    const profileByParent: Record<string, any> = {};
    const profileIds: string[] = [];
    (profiles || []).forEach((p: any) => {
      profileByParent[p.parent_id] = p;
      profileIds.push(p.id);
    });

    // mood_streak per profile
    const moodByProfile: Record<string, number> = {};
    if (profileIds.length > 0) {
      const { data: prefs } = await sb
        .from("user_preferences")
        .select("profile_id, mood_streak")
        .in("profile_id", profileIds);
      (prefs || []).forEach((p: any) => {
        moodByProfile[p.profile_id] = p.mood_streak || 0;
      });
    }

    // Recent assignments + results (last 7d)
    const { data: assignments } = await sb
      .from("teacher_assignments")
      .select("id")
      .eq("class_id", classId)
      .gte("assigned_at", sevenDaysAgo);
    const aIds = (assignments || []).map((a: any) => a.id);

    const studentAgg: Record<string, {
      sum: number; n: number; completed: number; total: number;
      errors: Record<string, number>;
    }> = {};

    if (aIds.length > 0) {
      const { data: results } = await sb
        .from("assignment_results")
        .select("student_id, status, score, errors_summary, created_at")
        .in("assignment_id", aIds);
      (results || []).forEach((r: any) => {
        const sid = r.student_id;
        if (!sid) return;
        if (!studentAgg[sid]) studentAgg[sid] = { sum: 0, n: 0, completed: 0, total: 0, errors: {} };
        studentAgg[sid].total++;
        if (r.status === "completed") studentAgg[sid].completed++;
        if (typeof r.score === "number") {
          studentAgg[sid].sum += r.score;
          studentAgg[sid].n++;
        }
        const es = r.errors_summary;
        if (es && typeof es === "object") {
          Object.entries(es).forEach(([topic, count]: [string, any]) => {
            if (isTechnicalKey(topic)) return;
            if (Array.isArray(count)) {
              count.forEach((t: any) => {
                if (typeof t === "string" && !isTechnicalKey(t)) {
                  studentAgg[sid].errors[t] = (studentAgg[sid].errors[t] || 0) + 1;
                }
              });
              return;
            }
            const c = typeof count === "number" ? count : 1;
            studentAgg[sid].errors[topic] = (studentAgg[sid].errors[topic] || 0) + c;
          });
        }
      });
    }

    // Recent sessions (7d) per parent_id (guided_sessions.user_id = parent uid)
    const sessionsByParent: Record<string, number> = {};
    const { data: sessions } = await sb
      .from("guided_sessions")
      .select("user_id, started_at")
      .in("user_id", studentParentIds)
      .gte("started_at", sevenDaysAgo);
    (sessions || []).forEach((s: any) => {
      sessionsByParent[s.user_id] = (sessionsByParent[s.user_id] || 0) + 1;
    });

    // Build per-student records
    const studenti: any[] = [];
    let nNorma = 0, nOcchio = 0, nAttenzione = 0;

    for (const parentId of studentParentIds) {
      const profile = profileByParent[parentId];
      if (!profile) continue; // no consent or missing profile

      const fullName = `${profile.name || ""}${profile.last_name ? " " + profile.last_name : ""}`.trim() || "Studente";
      const agg = studentAgg[parentId];
      const avgScore = agg && agg.n > 0 ? Math.round(agg.sum / agg.n) : null;
      const completionRatio = agg && agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : null;
      const sessionsCount = sessionsByParent[parentId] || 0;

      const moodStreak = moodByProfile[profile.id] || 0;
      const distressLevel = streakToLevel(moodStreak);

      // Top 2 fragile topics
      const topErrors = agg
        ? Object.entries(agg.errors).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t)
        : [];

      // No data case
      if (sessionsCount === 0 && (!agg || agg.total === 0) && distressLevel === 0) {
        studenti.push({
          parent_id: parentId,
          nome: fullName,
          categoria: "nella_norma",
          sintesi: "Non ha usato SarAI negli ultimi 7 giorni — dato non disponibile, non un segnale.",
          argomenti_fragili: [],
          azione_suggerita: null,
        });
        nNorma++;
        continue;
      }

      // Signal flags
      const academicLow = (avgScore != null && avgScore < 50) ||
        (completionRatio != null && completionRatio < 40);
      const academicMedium = !academicLow && (
        (avgScore != null && avgScore < 65) ||
        (completionRatio != null && completionRatio < 70)
      );
      const emotionalHigh = distressLevel >= 3;
      const emotionalMedium = distressLevel === 2;
      const lowFrequency = sessionsCount === 0;

      // Count "fronts" with signal (academic / emotional / frequency)
      const frontsWithSignal =
        (academicLow || academicMedium ? 1 : 0) +
        (emotionalHigh || emotionalMedium ? 1 : 0) +
        (lowFrequency && (emotionalHigh || emotionalMedium) ? 1 : 0);

      let categoria: "nella_norma" | "da_tenere_docchio" | "attenzione" = "nella_norma";

      if (emotionalHigh || (academicLow && (emotionalMedium || emotionalHigh)) || (lowFrequency && (emotionalMedium || emotionalHigh))) {
        categoria = "attenzione";
      } else if (frontsWithSignal >= 1 || academicMedium || emotionalMedium || (lowFrequency && agg && agg.total > 0)) {
        categoria = "da_tenere_docchio";
      } else {
        categoria = "nella_norma";
      }

      // Build human sintesi (no raw text, no diagnoses)
      let sintesi = "";
      let azione_suggerita: string | null = null;
      let cta_primaria: any = null;
      let cta_secondaria: any = null;

      if (categoria === "nella_norma") {
        if (avgScore != null && avgScore >= 75) {
          sintesi = "Sta lavorando bene — risultati stabili e frequenza regolare.";
        } else if (sessionsCount > 0) {
          sintesi = "Nessun segnale particolare — procede in modo equilibrato.";
        } else {
          sintesi = "Procede in modo equilibrato.";
        }
        nNorma++;
      } else if (categoria === "da_tenere_docchio") {
        const parts: string[] = [];
        if (academicMedium || academicLow) parts.push("risultati in lieve calo sulle ultime attività");
        if (emotionalMedium) parts.push("qualche segnale di fatica emotiva ricorrente");
        if (lowFrequency && agg && agg.total > 0) parts.push("ha lasciato indietro alcune attività");
        sintesi = parts.length > 0
          ? `${parts.join(", ")}. Vale la pena un'osservazione discreta nei prossimi giorni.`
          : "Qualche piccolo segnale isolato — niente di urgente, ma vale la pena tenere d'occhio.";
        sintesi = sintesi.charAt(0).toUpperCase() + sintesi.slice(1);
        nOcchio++;
      } else {
        // attenzione 🔴
        const parts: string[] = [];
        if (emotionalHigh) parts.push("segnali di fatica emotiva ricorrenti nelle ultime sessioni");
        if (academicLow) parts.push("risultati sotto la media e attività non completate");
        else if (academicMedium) parts.push("risultati in calo");
        if (lowFrequency && (emotionalMedium || emotionalHigh)) parts.push("assenza prolungata da SarAI");
        sintesi = parts.length > 0
          ? `${parts.join(", combinati con ").charAt(0).toUpperCase() + parts.join(", combinati con ").slice(1)}. Conviene un contatto diretto a breve.`
          : "Più segnali convergenti — merita attenzione diretta nei prossimi giorni.";
        azione_suggerita = "Contatto diretto consigliato a breve.";
        cta_primaria = {
          label: "Apri profilo",
          action: "open_studente",
          params: { studente_id: parentId, classe_id: classId },
        };
        if (topErrors.length > 0) {
          cta_secondaria = {
            label: "Genera recupero",
            action: "open_materiali",
            params: {
              tipo: "recupero",
              studente_id: parentId,
              classe_id: classId,
              argomento: topErrors[0],
            },
          };
        }
        nAttenzione++;
      }

      studenti.push({
        parent_id: parentId,
        nome: fullName,
        categoria,
        sintesi,
        argomenti_fragili: topErrors,
        azione_suggerita,
        cta_primaria,
        cta_secondaria,
      });
    }

    // Sort: 🔴 first, then 🟡, then 🟢
    const order = { attenzione: 0, da_tenere_docchio: 1, nella_norma: 2 } as const;
    studenti.sort((a, b) => order[a.categoria as keyof typeof order] - order[b.categoria as keyof typeof order]);

    return new Response(JSON.stringify({
      generato_il: new Date().toISOString().slice(0, 10),
      periodo: "ultimi 7 giorni",
      classe: className,
      riepilogo: {
        nella_norma: nNorma,
        da_tenere_docchio: nOcchio,
        attenzione: nAttenzione,
      },
      studenti,
      nota: "Questo quadro è una sintesi osservazionale degli ultimi 7 giorni — non una valutazione permanente.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("class-checkin-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
