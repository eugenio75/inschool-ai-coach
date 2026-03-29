import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { child_profile_id, force_refresh } = await req.json();
    if (!child_profile_id) {
      return new Response(JSON.stringify({ error: "child_profile_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verify parent owns this child
    const { data: childProfile, error: childErr } = await supabase
      .from("child_profiles")
      .select("id, name, school_level, age")
      .eq("id", child_profile_id)
      .single();

    if (childErr || !childProfile) {
      return new Response(JSON.stringify({ error: "Child not found or unauthorized" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const childName = childProfile.name;

    // Check cache via user_preferences data field (avoid new table)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use a simple cache key approach in the child_profiles or a lightweight check
    const cacheKey = `daily_summary_${child_profile_id}_${today}`;
    
    // Check translation_cache for our summary cache (reuse existing table)
    if (!force_refresh) {
      const { data: cached } = await serviceClient
        .from("translation_cache")
        .select("value")
        .eq("key", cacheKey)
        .eq("lang", "summary")
        .single();

      if (cached?.value) {
        const parsed = JSON.parse(cached.value);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch today's data
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      { data: focusSessions },
      { data: checkins },
      { data: learningErrors },
      { data: guidedSessions },
      { data: gamification },
      { data: tasks },
    ] = await Promise.all([
      serviceClient
        .from("focus_sessions")
        .select("*, homework_tasks(subject, title)")
        .eq("child_profile_id", child_profile_id)
        .gte("completed_at", todayStart)
        .lte("completed_at", todayEnd),
      serviceClient
        .from("emotional_checkins")
        .select("*")
        .eq("child_profile_id", child_profile_id)
        .eq("checkin_date", today),
      serviceClient
        .from("learning_errors")
        .select("*")
        .eq("user_id", child_profile_id)
        .eq("resolved", false)
        .gte("created_at", sevenDaysAgo),
      serviceClient
        .from("guided_sessions")
        .select("*")
        .eq("user_id", child_profile_id)
        .gte("started_at", todayStart)
        .lte("started_at", todayEnd),
      serviceClient
        .from("gamification")
        .select("*")
        .eq("child_profile_id", child_profile_id)
        .single(),
      serviceClient
        .from("homework_tasks")
        .select("id, subject, title")
        .eq("child_profile_id", child_profile_id),
    ]);

    // Check for no activity
    const sessions = focusSessions || [];
    const hasActivity = sessions.length > 0 || (guidedSessions || []).length > 0;

    if (!hasActivity) {
      const result = {
        summary: `Oggi ${childName} non ha ancora studiato. Puoi incoraggiarlo ad aprire InSchool.`,
        has_attention_signal: false,
        generated_at: new Date().toISOString(),
        today_stats: {
          study_minutes: 0,
          focus_sessions: 0,
          guided_sessions: 0,
          total_sessions: 0,
          completed_tasks: 0,
        },
      };

      // Don't cache "no activity" — might change later in the day
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute attention signals
    const attentionSignals: string[] = [];

    // 1. Emotional tone "low" for 3+ consecutive days
    const { data: recentCheckins } = await serviceClient
      .from("emotional_checkins")
      .select("checkin_date, emotional_tone, energy_level")
      .eq("child_profile_id", child_profile_id)
      .order("checkin_date", { ascending: false })
      .limit(5);

    if (recentCheckins && recentCheckins.length >= 3) {
      const consecutiveLow = recentCheckins
        .slice(0, 3)
        .every((c) => c.emotional_tone === "low" || c.energy_level === "low");
      if (consecutiveLow) {
        attentionSignals.push(
          `Ho notato che negli ultimi giorni ${childName} sembra un po' stanco — potrebbe valere la pena parlargli.`
        );
      }
    }

    // 2. More than 3 unresolved errors in the same subject
    const errorsBySubject: Record<string, number> = {};
    for (const err of learningErrors || []) {
      const subj = err.subject || "Altro";
      errorsBySubject[subj] = (errorsBySubject[subj] || 0) + 1;
    }
    for (const [subj, count] of Object.entries(errorsBySubject)) {
      if (count > 3) {
        attentionSignals.push(
          `Ci sono ${count} errori non ancora risolti in ${subj} — potrebbe aver bisogno di un po' di supporto.`
        );
      }
    }

    // 3. Guided session paused > 48h
    const { data: pausedSessions } = await serviceClient
      .from("guided_sessions")
      .select("*")
      .eq("user_id", child_profile_id)
      .eq("status", "active")
      .lt("updated_at", new Date(Date.now() - 48 * 3600000).toISOString());

    if (pausedSessions && pausedSessions.length > 0) {
      attentionSignals.push(
        `Ha una sessione di studio in pausa da più di 48 ore.`
      );
    }

    // 4. Streak broken today
    if (gamification) {
      const lastActivity = gamification.last_activity_date;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const now = new Date();
      if (
        lastActivity === yesterday &&
        now.getHours() >= 20 &&
        !sessions.some((s: any) => s.completed_at?.startsWith(today))
      ) {
        attentionSignals.push(`La costanza si è interrotta oggi.`);
      }
    }

    // Build data context for AI — use active study time from focus_sessions
    // Also include guided_sessions.duration_seconds (corrected active time)
    const focusMinutes = sessions.reduce(
      (a: number, s: any) => a + Math.round((s.duration_seconds || 0) / 60),
      0
    );
    const guidedMinutes = (guidedSessions || []).reduce(
      (a: number, s: any) => a + Math.round((s.duration_seconds || 0) / 60),
      0
    );
    const totalMinutes = focusMinutes + guidedMinutes;
    const subjects = [
      ...new Set(
        sessions
          .map((s: any) => {
            const task = (tasks || []).find((t: any) => t.id === s.task_id);
            return task?.subject || s.homework_tasks?.subject || null;
          })
          .filter(Boolean)
      ),
    ];
    const todayCheckin = (checkins || [])[0];
    const completedGuided = (guidedSessions || []).filter(
      (g: any) => g.status === "completed"
    ).length;

    const dataContext = `
Nome: ${childName}
Minuti studiati oggi: ${totalMinutes}
Materie: ${subjects.join(", ") || "non specificate"}
Sessioni focus: ${sessions.length}
Sessioni guidate completate: ${completedGuided}
Stato emotivo oggi: ${todayCheckin ? `tono: ${todayCheckin.emotional_tone}, energia: ${todayCheckin.energy_level}` : "non registrato"}
Errori non risolti (ultimi 7 giorni): ${JSON.stringify(errorsBySubject)}
Streak attuale: ${gamification?.streak || 0} giorni
${attentionSignals.length > 0 ? `Segnali di attenzione:\n${attentionSignals.map((s) => `- ${s}`).join("\n")}` : "Nessun segnale di attenzione."}
`.trim();

    // Call AI
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sei un coach educativo che scrive un breve aggiornamento giornaliero per un genitore su come è andata la giornata di studio del figlio. Tono: caldo, diretto, rassicurante. Lunghezza: 2-4 frasi. Solo prosa naturale, niente elenchi. Includi: tempo studiato e materie, stato emotivo, eventuali difficoltà emerse. Se tutto va bene dillo chiaramente. Se ci sono segnali di attenzione segnalali con delicatezza senza allarmare. Non usare emoji. Rispondi SOLO con il testo della sintesi, nient'altro.`,
          },
          {
            role: "user",
            content: `Ecco i dati della giornata di studio:\n\n${dataContext}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI call failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary =
      aiData.choices?.[0]?.message?.content?.trim() ||
      `Oggi ${childName} ha studiato ${totalMinutes} minuti. Tutto nella norma.`;

    const result = {
      summary,
      has_attention_signal: attentionSignals.length > 0,
      attention_signals: attentionSignals,
      generated_at: new Date().toISOString(),
      today_stats: {
        study_minutes: totalMinutes,
        focus_sessions: sessions.length,
        guided_sessions: completedGuided,
        total_sessions: sessions.length + completedGuided,
        completed_tasks: (tasks || []).filter((t: any) => t.completed).length,
      },
    };

    // Cache result
    await serviceClient.from("translation_cache").upsert(
      {
        key: cacheKey,
        lang: "summary",
        value: JSON.stringify(result),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lang,key" }
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("daily-child-summary error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
