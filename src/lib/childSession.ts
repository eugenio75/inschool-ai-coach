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

  const callChildApiEdge = async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
      },
      body: JSON.stringify({
        action,
        accessCode: session.accessCode,
        childProfileId: profileId,
        payload,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Errore di comunicazione");
    return result;
  };

  try {
    switch (action) {
      case "get-tasks":
      case "get-task":
      case "create-task":
      case "save-task":
      case "update-task":
      case "delete-task": {
        return callChildApiEdge();
      }
      case "get-gamification":
      case "get-memory-items":
      case "update-memory-strength":
      case "get-learning-errors":
      case "get-flagged-flashcards":
      case "get-badges":
      case "get-focus-sessions":
      case "save-focus-session":
      case "get-daily-missions":
      case "complete-mission":
      case "save-checkin":
      case "get-paused-session":
      case "create-session":
      case "update-session":
      case "complete-session": {
        return callChildApiEdge();
      }
      case "insert-steps":
      case "update-step": {
        return callChildApiEdge();
      }
      case "update-profile": {
        const data = await callChildApiEdge();
        if (data) {
          // Update local session
          const currentSession = getChildSession();
          if (currentSession) {
            setChildSession({ ...currentSession, profile: { ...currentSession.profile, ...data } as any });
          }
        }
        return data;
      }
      case "get-user-preferences": {
        return callChildApiEdge();
      }
      case "save-user-preferences": {
        return callChildApiEdge();
      }
      case "upload-homework-image": {
        return callChildApiEdge();
      }
      case "delete-homework-images": {
        return callChildApiEdge();
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
