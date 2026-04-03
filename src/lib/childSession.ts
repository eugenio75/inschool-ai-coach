// Child session management - for children who log in with access code (no Supabase auth)

interface ChildSession {
  profileId: string;
  accessCode: string;
  profile: {
    id: string;
    name: string;
    last_name?: string | null;
    age: number | null;
    avatar_emoji: string | null;
    gender: string | null;
    school_level: string | null;
    favorite_subjects: string[] | null;
    difficult_subjects: string[] | null;
    struggles: string[] | null;
    focus_time: number | null;
    support_style: string | null;
    interests: string[] | null;
    school_name?: string | null;
    school_code?: string | null;
    city?: string | null;
    class_section?: string | null;
  };
}

const CHILD_SESSION_KEY = "inschool-child-session";
const ADULT_ROLES = new Set(["superiori", "universitario", "docente"]);

export function getChildSession(): ChildSession | null {
  try {
    const stored = localStorage.getItem(CHILD_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setChildSession(session: ChildSession) {
  localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session));
  // Also set the profile data for components that read it
  localStorage.setItem("inschool-active-child-id", session.profileId);
  localStorage.setItem("inschool-profile", JSON.stringify({
    id: session.profile.id,
    name: session.profile.name,
    age: session.profile.age,
    gender: session.profile.gender,
    avatarEmoji: session.profile.avatar_emoji,
    schoolLevel: session.profile.school_level,
    school_level: session.profile.school_level,
    favoriteSubjects: session.profile.favorite_subjects,
    favorite_subjects: session.profile.favorite_subjects,
    difficultSubjects: session.profile.difficult_subjects,
    difficult_subjects: session.profile.difficult_subjects,
    struggles: session.profile.struggles,
    focusTime: session.profile.focus_time?.toString() || "15",
    supportStyle: session.profile.support_style,
    interests: session.profile.interests,
    school_name: session.profile.school_name,
    school_code: session.profile.school_code,
    city: session.profile.city,
    class_section: session.profile.class_section,
  }));
}

export function clearChildSession() {
  localStorage.removeItem(CHILD_SESSION_KEY);
  localStorage.removeItem("inschool-active-child-id");
  localStorage.removeItem("inschool-profile");
}

export function isChildSession(): boolean {
  const session = getChildSession();
  const schoolLevel = session?.profile?.school_level || null;
  return !!session && !ADULT_ROLES.has(schoolLevel || "");
}

export function isAdultProfileSession(): boolean {
  const session = getChildSession();
  const schoolLevel = session?.profile?.school_level || null;
  return !!session && ADULT_ROLES.has(schoolLevel || "");
}

// Direct Supabase queries for child session — no edge function needed
export async function childApi(action: string, payload?: any): Promise<any> {
  const session = getChildSession();
  if (!session) throw new Error("Nessuna sessione bambino attiva");

  const { supabase } = await import("@/integrations/supabase/client");
  const profileId = session.profileId;

  try {
    switch (action) {
      case "get-tasks": {
        const { data } = await supabase.from("homework_tasks").select("*").eq("child_profile_id", profileId).order("created_at", { ascending: false });
        return data || [];
      }
      case "get-task": {
        const { data } = await supabase.from("homework_tasks").select("*").eq("id", payload.taskId).eq("child_profile_id", profileId).maybeSingle();
        return data;
      }
      case "create-task":
      case "save-task": {
        const { data } = await supabase.from("homework_tasks").insert({ ...payload, child_profile_id: profileId }).select().single();
        return data;
      }
      case "update-task": {
        const { taskId, updates, ...rest } = payload;
        const upd = updates || rest;
        const { data } = await supabase.from("homework_tasks").update(upd).eq("id", taskId).eq("child_profile_id", profileId).select().single();
        return data;
      }
      case "delete-task": {
        await supabase.from("homework_tasks").delete().eq("id", payload.taskId).eq("child_profile_id", profileId);
        return { success: true };
      }
      case "get-gamification": {
        const { data } = await supabase.rpc("get_child_gamification", { p_profile_id: profileId });
        return data;
      }
      case "get-memory-items": {
        const { data } = await supabase.from("memory_items").select("*").eq("child_profile_id", profileId).order("created_at", { ascending: false });
        return data || [];
      }
      case "update-memory-strength": {
        const { data } = await supabase.from("memory_items").update({ strength: payload.strength, last_reviewed: new Date().toISOString() }).eq("id", payload.itemId).eq("child_profile_id", profileId).select().single();
        return data;
      }
      case "get-learning-errors": {
        const { data } = await supabase.from("learning_errors").select("*").eq("user_id", profileId).order("created_at", { ascending: false });
        return data || [];
      }
      case "get-flagged-flashcards": {
        const { data } = await supabase.from("flashcards").select("*").eq("user_id", profileId).eq("is_flagged", true);
        return data || [];
      }
      case "get-badges": {
        const { data } = await supabase.from("badges").select("*").eq("child_profile_id", profileId);
        return data || [];
      }
      case "get-focus-sessions": {
        const { data } = await supabase.from("focus_sessions").select("*").eq("child_profile_id", profileId).order("completed_at", { ascending: false });
        return data || [];
      }
      case "save-focus-session": {
        const { data } = await supabase.from("focus_sessions").insert({ ...payload, child_profile_id: profileId }).select().single();
        return data;
      }
      case "get-daily-missions": {
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase.rpc("get_child_daily_missions", { p_profile_id: profileId, p_date: today });
        return data || [];
      }
      case "complete-mission": {
        const { data } = await supabase.from("daily_missions").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", payload.missionId).eq("child_profile_id", profileId).select().single();
        // Update gamification points
        if (payload.pointsReward) {
          await supabase.rpc("generate_child_access_code").then(() => {}); // no-op, just placeholder
          const { data: gam } = await supabase.from("gamification").select("*").eq("child_profile_id", profileId).maybeSingle();
          if (gam) {
            await supabase.from("gamification").update({ focus_points: (gam.focus_points || 0) + payload.pointsReward, updated_at: new Date().toISOString() }).eq("child_profile_id", profileId);
          }
        }
        return data;
      }
      case "save-checkin": {
        const { data } = await supabase.from("emotional_checkins").insert({ ...payload, child_profile_id: profileId }).select().single();
        return data;
      }
      case "get-paused-session": {
        const { data: sessions } = await supabase.from("guided_sessions").select("*, conversation_sessions(*)").eq("user_id", profileId).eq("homework_id", payload.homeworkId).order("started_at", { ascending: false }).limit(1);
        if (!sessions || sessions.length === 0) return { session: null, completed: false, steps: [] };
        const sess = sessions[0];
        const { data: steps } = await supabase.from("study_steps").select("*").eq("session_id", sess.id).order("step_number");
        return { session: sess, completed: sess.status === "completed", steps: steps || [] };
      }
      case "create-session": {
        const { data } = await supabase.from("guided_sessions").insert({
          user_id: profileId,
          homework_id: payload.homeworkId,
          total_steps: payload.totalSteps,
          emotional_checkin: payload.emotionalCheckin || null,
          status: "active",
          current_step: 1,
          started_at: new Date().toISOString(),
        }).select().single();
        return data;
      }
      case "update-session": {
        const { sessionId, updates } = payload;
        const { data } = await supabase.from("guided_sessions").update(updates).eq("id", sessionId).eq("user_id", profileId).select().single();
        return data;
      }
      case "insert-steps": {
        const { data } = await supabase.from("study_steps").insert(payload.steps.map((s: any) => ({ ...s, user_id: profileId }))).select();
        return data;
      }
      case "update-profile": {
        const { data } = await supabase.from("child_profiles").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", profileId).select().single();
        if (data) {
          // Update local session
          const currentSession = getChildSession();
          if (currentSession) {
            setChildSession({ ...currentSession, profile: { ...currentSession.profile, ...data } as any });
          }
        }
        return data;
      }
      case "upload-homework-image": {
        const { base64, fileName } = payload;
        const bytes = Uint8Array.from(atob(base64.split(",").pop() || base64), c => c.charCodeAt(0));
        const path = `${profileId}/${Date.now()}_${fileName}`;
        const { error } = await supabase.storage.from("homework-images").upload(path, bytes, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("homework-images").getPublicUrl(path);
        return { url: urlData.publicUrl };
      }
      default:
        console.warn(`childApi: unknown action "${action}", returning empty`);
        return [];
    }
  } catch (err: any) {
    console.error(`childApi error (${action}):`, err);
    throw new Error(err.message || "Errore di comunicazione");
  }
}

// Login with access code — direct Supabase query (no edge function)
export async function loginWithChildCode(code: string): Promise<ChildSession> {
  const { supabase } = await import("@/integrations/supabase/client");
  
  const { data, error } = await supabase.rpc("validate_child_code", { code: code.toUpperCase().trim() });
  const result = data as any;
  
  if (error || !result?.valid) {
    throw new Error("Codice non valido. Controlla e riprova!");
  }

  const session: ChildSession = {
    profileId: result.profile.id,
    accessCode: code.toUpperCase().trim(),
    profile: result.profile,
  };
  setChildSession(session);
  return session;
}
