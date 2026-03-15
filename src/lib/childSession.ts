// Child session management - for children who log in with access code (no Supabase auth)

interface ChildSession {
  profileId: string;
  accessCode: string;
  profile: {
    id: string;
    name: string;
    age: number | null;
    avatar_emoji: string | null;
    school_level: string | null;
    favorite_subjects: string[] | null;
    difficult_subjects: string[] | null;
    struggles: string[] | null;
    focus_time: number | null;
    support_style: string | null;
  };
}

const CHILD_SESSION_KEY = "inschool-child-session";

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
    name: session.profile.name,
    age: session.profile.age,
    schoolLevel: session.profile.school_level,
    favoriteSubjects: session.profile.favorite_subjects,
    difficultSubjects: session.profile.difficult_subjects,
    struggles: session.profile.struggles,
    focusTime: session.profile.focus_time?.toString() || "15",
    supportStyle: session.profile.support_style,
  }));
}

export function clearChildSession() {
  localStorage.removeItem(CHILD_SESSION_KEY);
  localStorage.removeItem("inschool-active-child-id");
  localStorage.removeItem("inschool-profile");
}

export function isChildSession(): boolean {
  return !!getChildSession();
}

// API calls through the child-api edge function
export async function childApi(action: string, payload?: any) {
  const session = getChildSession();
  if (!session) throw new Error("Nessuna sessione bambino attiva");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        accessCode: session.accessCode,
        childProfileId: session.profileId,
        payload,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearChildSession();
      window.location.href = "/auth";
      throw new Error("Sessione scaduta");
    }
    throw new Error(err.error || "Errore di comunicazione");
  }

  return response.json();
}

// Login with access code
export async function loginWithChildCode(code: string): Promise<ChildSession> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", accessCode: code }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Codice non valido");
  }

  const data = await response.json();
  const session: ChildSession = {
    profileId: data.profile.id,
    accessCode: code.toUpperCase().trim(),
    profile: data.profile,
  };
  setChildSession(session);
  return session;
}
