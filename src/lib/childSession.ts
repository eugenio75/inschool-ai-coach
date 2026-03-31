// Child session management - for children who log in with access code (no Supabase auth)

interface ChildSession {
  profileId: string;
  accessCode: string;
  profile: {
    id: string;
    name: string;
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
    favoriteSubjects: session.profile.favorite_subjects,
    difficultSubjects: session.profile.difficult_subjects,
    struggles: session.profile.struggles,
    focusTime: session.profile.focus_time?.toString() || "15",
    supportStyle: session.profile.support_style,
    interests: session.profile.interests,
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
export async function childApi(action: string, payload?: any) {
  const session = getChildSession();
  if (!session) throw new Error("Nessuna sessione bambino attiva");

  const { supabase } = await import("@/integrations/supabase/client");
  const profileId = session.profileId;

  try {
    switch (action) {
      case "get-tasks": {
        const { data } = await supabase
          .from("homework_tasks")
          .select("*")
          .eq("child_profile_id", profileId)
          .order("created_at", { ascending: false });
        return data || [];
      }
      case "save-task": {
        const { data } = await supabase
          .from("homework_tasks")
          .insert({ ...payload, child_profile_id: profileId })
          .select()
          .single();
        return data;
      }
      case "update-task": {
        const { taskId, ...updates } = payload;
        const { data } = await supabase
          .from("homework_tasks")
          .update(updates)
          .eq("id", taskId)
          .eq("child_profile_id", profileId)
          .select()
          .single();
        return data;
      }
      case "delete-task": {
        await supabase
          .from("homework_tasks")
          .delete()
          .eq("id", payload.taskId)
          .eq("child_profile_id", profileId);
        return { success: true };
      }
      case "get-gamification": {
        const { data } = await supabase
          .from("gamification")
          .select("*")
          .eq("child_profile_id", profileId)
          .maybeSingle();
        return data;
      }
      case "get-memory-items": {
        const { data } = await supabase
          .from("memory_items")
          .select("*")
          .eq("child_profile_id", profileId)
          .order("created_at", { ascending: false });
        return data || [];
      }
      case "get-learning-errors": {
        const { data } = await supabase
          .from("learning_errors")
          .select("*")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false });
        return data || [];
      }
      case "get-flagged-flashcards": {
        const { data } = await supabase
          .from("flashcards")
          .select("*")
          .eq("user_id", profileId)
          .eq("is_flagged", true);
        return data || [];
      }
      case "get-badges": {
        const { data } = await supabase
          .from("badges")
          .select("*")
          .eq("child_profile_id", profileId);
        return data || [];
      }
      case "get-focus-sessions": {
        const { data } = await supabase
          .from("focus_sessions")
          .select("*")
          .eq("child_profile_id", profileId)
          .order("completed_at", { ascending: false });
        return data || [];
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
  
  if (error || !data?.valid) {
    throw new Error("Codice non valido. Controlla e riprova!");
  }

  const session: ChildSession = {
    profileId: data.profile.id,
    accessCode: code.toUpperCase().trim(),
    profile: data.profile,
  };
  setChildSession(session);
  return session;
}
