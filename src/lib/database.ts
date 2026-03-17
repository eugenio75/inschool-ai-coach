import { supabase } from "@/integrations/supabase/client";
import { isChildSession, childApi } from "@/lib/childSession";

// ============ CHILD PROFILE CONTEXT ============

export function getActiveChildProfileId(): string | null {
  return localStorage.getItem("inschool-active-child-id");
}

export function setActiveChildProfileId(id: string) {
  localStorage.setItem("inschool-active-child-id", id);
}

export function clearActiveChildProfileId() {
  localStorage.removeItem("inschool-active-child-id");
}

// ============ CHILD PROFILES ============

export async function getChildProfiles() {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) console.error("getChildProfiles error:", error);
  return data || [];
}

export async function getChildProfile(profileId: string) {
  if (isChildSession()) {
    // In child session, profile is already in localStorage
    const saved = localStorage.getItem("inschool-profile");
    if (saved) try { return JSON.parse(saved); } catch {}
    return null;
  }

  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (error) console.error("getChildProfile error:", error);
  return data;
}

export async function createChildProfile(profile: {
  name: string;
  avatar_emoji?: string;
  age?: number;
  school_level?: string;
  favorite_subjects?: string[];
  difficult_subjects?: string[];
  struggles?: string[];
  focus_time?: number;
  support_style?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Generate access code
  const { data: codeData } = await supabase.rpc("generate_child_access_code");
  const accessCode = codeData || undefined;

  const { data, error } = await supabase
    .from("child_profiles")
    .insert({ parent_id: user.id, access_code: accessCode, ...profile })
    .select()
    .single();
  if (error) console.error("createChildProfile error:", error);
  
  // Auto-create gamification record
  if (data) {
    await supabase.from("gamification").insert({ child_profile_id: data.id });
  }
  
  return data;
}

export async function updateChildProfile(profileId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from("child_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select()
    .single();
  if (error) console.error("updateChildProfile error:", error);
  return data;
}

// ============ PARENT SETTINGS ============

export async function getParentSettings() {
  const { data, error } = await supabase
    .from("parent_settings")
    .select("*")
    .maybeSingle();
  if (error) console.error("getParentSettings error:", error);
  return data;
}

export async function updateParentPin(pin: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("parent_settings")
    .update({ parent_pin: pin })
    .eq("user_id", user.id);
  if (error) console.error("updateParentPin error:", error);
}

// ============ HOMEWORK TASKS ============

export async function getTasks(childProfileId?: string) {
  if (isChildSession()) {
    return childApi("get-tasks");
  }

  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  // Show tasks due today or earlier (+ tasks without due_date for backwards compat)
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("homework_tasks")
    .select("*")
    .eq("child_profile_id", profileId)
    .or(`due_date.is.null,due_date.lte.${today}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) console.error("getTasks error:", error);
  return data || [];
}

export async function getTask(taskId: string) {
  if (isChildSession()) {
    return childApi("get-task", { taskId });
  }

  const { data, error } = await supabase
    .from("homework_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (error) console.error("getTask error:", error);
  return data;
}

export async function createTask(task: {
  subject: string;
  title: string;
  description?: string;
  estimated_minutes?: number;
  difficulty?: number;
  micro_steps?: any[];
  key_concepts?: string[];
  recall_questions?: string[];
  source_type?: string;
  source_image_url?: string;
  due_date?: string;
  task_type?: string;
}) {
  if (isChildSession()) {
    return childApi("create-task", task);
  }

  const profileId = getActiveChildProfileId();
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("homework_tasks")
    .insert({ child_profile_id: profileId, ...task })
    .select()
    .single();
  if (error) console.error("createTask error:", error);
  return data;
}

export async function updateTask(taskId: string, updates: Record<string, any>) {
  if (isChildSession()) {
    return childApi("update-task", { taskId, updates });
  }

  const { data, error } = await supabase
    .from("homework_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single();
  if (error) console.error("updateTask error:", error);
  return data;
}

// ============ FOCUS SESSIONS ============

export async function saveFocusSession(session: {
  task_id?: string;
  emotion?: string;
  duration_seconds: number;
  focus_points?: number;
  autonomy_points?: number;
  consistency_points?: number;
}) {
  if (isChildSession()) {
    return childApi("save-focus-session", session);
  }

  const profileId = getActiveChildProfileId();
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({ child_profile_id: profileId, ...session })
    .select()
    .single();
  if (error) console.error("saveFocusSession error:", error);

  if (data) {
    await updateGamificationPoints(
      profileId,
      session.focus_points || 0,
      session.autonomy_points || 0,
      session.consistency_points || 0
    );
  }
  return data;
}

export async function getFocusSessions(childProfileId?: string) {
  if (isChildSession()) {
    return childApi("get-focus-sessions");
  }

  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("child_profile_id", profileId)
    .order("completed_at", { ascending: false });
  if (error) console.error("getFocusSessions error:", error);
  return data || [];
}

// ============ GAMIFICATION ============

export async function getGamification(childProfileId?: string) {
  if (isChildSession()) {
    return childApi("get-gamification");
  }

  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("gamification")
    .select("*")
    .eq("child_profile_id", profileId)
    .maybeSingle();
  if (error) console.error("getGamification error:", error);
  return data;
}

async function updateGamificationPoints(profileId: string, focus: number, autonomy: number, consistency: number) {
  const current = await getGamification(profileId);
  if (!current) return;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = current.last_activity_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let newStreak = current.streak || 0;
  let shields = (current as any).streak_shields || 0;
  let nextShieldAt = (current as any).next_shield_at || 7;

  if (lastDate === yesterday) {
    newStreak += 1;
  } else if (lastDate !== today) {
    // Missed day(s) - use shield if available
    if (shields > 0) {
      shields -= 1;
      // Keep streak, don't reset
    } else {
      newStreak = 1;
    }
  }

  // Award shield every 7 consecutive days
  if (newStreak >= nextShieldAt) {
    shields += 1;
    nextShieldAt = newStreak + 7;
  }

  await supabase
    .from("gamification")
    .update({
      focus_points: (current.focus_points || 0) + focus,
      autonomy_points: (current.autonomy_points || 0) + autonomy,
      consistency_points: (current.consistency_points || 0) + consistency,
      streak: newStreak,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
      streak_shields: shields,
      next_shield_at: nextShieldAt,
    } as any)
    .eq("child_profile_id", profileId);
}

// ============ MEMORY ITEMS ============

export async function getMemoryItems(childProfileId?: string) {
  if (isChildSession()) {
    return childApi("get-memory-items");
  }

  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  const { data, error } = await supabase
    .from("memory_items")
    .select("*")
    .eq("child_profile_id", profileId)
    .order("strength", { ascending: true });
  if (error) console.error("getMemoryItems error:", error);
  return data || [];
}

export async function createMemoryItem(item: {
  subject: string;
  concept: string;
  summary?: string;
  recall_questions?: string[];
  strength?: number;
}) {
  const profileId = getActiveChildProfileId();
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("memory_items")
    .insert({ child_profile_id: profileId, ...item })
    .select()
    .single();
  if (error) console.error("createMemoryItem error:", error);
  return data;
}

export async function updateMemoryStrength(itemId: string, strength: number) {
  if (isChildSession()) {
    return childApi("update-memory-strength", { itemId, strength });
  }

  await supabase
    .from("memory_items")
    .update({ strength, last_reviewed: new Date().toISOString() })
    .eq("id", itemId);
}

// ============ DAILY MISSIONS ============

export async function getDailyMissions(childProfileId?: string): Promise<any[]> {
  if (isChildSession()) {
    return childApi("get-daily-missions");
  }

  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  // Call the generate-missions edge function which returns existing or creates new
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-missions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ childProfileId: profileId }),
      }
    );
    if (!response.ok) return [];
    const result = await response.json();
    return result.missions || [];
  } catch (err) {
    console.error("getDailyMissions error:", err);
    return [];
  }
}

export async function completeMission(missionId: string, pointsReward: number) {
  if (isChildSession()) {
    return childApi("complete-mission", { missionId, pointsReward });
  }

  const profileId = getActiveChildProfileId();
  if (!profileId) return;

  await supabase
    .from("daily_missions")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", missionId);

  // Add points to gamification
  const current = await getGamification(profileId);
  if (current) {
    await supabase.from("gamification").update({
      focus_points: (current.focus_points || 0) + pointsReward,
      updated_at: new Date().toISOString(),
    }).eq("child_profile_id", profileId);
  }
}

// ============ EMOTIONAL CHECKINS ============

export async function saveEmotionalCheckin(checkin: {
  responses: any[];
  emotional_tone: string;
  energy_level: string;
  signals: string[];
}) {
  if (isChildSession()) {
    return childApi("save-checkin", checkin);
  }

  const profileId = getActiveChildProfileId();
  if (!profileId) return null;

  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("emotional_checkins")
    .upsert({
      child_profile_id: profileId,
      checkin_date: today,
      ...checkin,
    } as any, { onConflict: "child_profile_id,checkin_date" })
    .select()
    .single();
  if (error) console.error("saveEmotionalCheckin error:", error);

  // Trigger async analysis
  triggerEmotionalAnalysis(profileId);

  return data;
}

export async function getEmotionalAlerts(childProfileId?: string) {
  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  const { data, error } = await supabase
    .from("emotional_alerts")
    .select("*")
    .eq("child_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) console.error("getEmotionalAlerts error:", error);
  return data || [];
}

export async function markAlertRead(alertId: string) {
  await supabase
    .from("emotional_alerts")
    .update({ read: true } as any)
    .eq("id", alertId);
}

async function triggerEmotionalAnalysis(profileId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-emotions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ childProfileId: profileId }),
      }
    );
  } catch (err) {
    console.error("Emotional analysis trigger error:", err);
  }
}

// ============ IMAGE UPLOAD ============

export async function uploadHomeworkImage(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "anonymous";
  const fileName = `${userId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from("homework-images")
    .upload(fileName, file);
  if (error) { console.error("Upload error:", error); return null; }

  const { data: urlData } = supabase.storage
    .from("homework-images")
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ============ OCR ============

export async function extractTasksFromImage(imageUrl: string, sourceType: string, userNote?: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ imageUrl, sourceType, userNote: userNote || undefined }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nell'analisi dell'immagine");
  }
  return response.json();
}
