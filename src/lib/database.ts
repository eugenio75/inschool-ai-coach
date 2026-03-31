import { supabase } from "@/integrations/supabase/client";
import { isChildSession, childApi } from "@/lib/childSession";
import { getCurrentLang } from "@/lib/langUtils";

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
  gender?: string;
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

  // Show: incomplete tasks + tasks completed today (hide completed tasks from previous days)
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00.000Z`;

  const { data, error } = await supabase
    .from("homework_tasks")
    .select("*")
    .eq("child_profile_id", profileId)
    .or(`due_date.is.null,due_date.lte.${today}`)
    .or(`completed.eq.false,completed.is.null,updated_at.gte.${todayStart}`)
    .order("created_at", { ascending: false });
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
  source_files?: string[];
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

export async function deleteTask(taskId: string) {
  if (isChildSession()) {
    return childApi("delete-task", { taskId });
  }

  const { error } = await supabase
    .from("homework_tasks")
    .delete()
    .eq("id", taskId);
  if (error) console.error("deleteTask error:", error);
  return !error;
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

export async function getGamification(childProfileId?: string): Promise<any> {
  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return null;

  // Use RPC (SECURITY DEFINER) — works for both authenticated and child sessions
  try {
    const { data, error } = await supabase.rpc("get_child_gamification", { p_profile_id: profileId });
    if (!error && data) return data as any;
  } catch (e) {
    console.warn("get_child_gamification RPC error:", e);
  }

  // Fallback to direct query (works only for authenticated parents)
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
    .order("created_at", { ascending: false });
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
  const profileId = childProfileId || getActiveChildProfileId();
  if (!profileId) return [];

  const today = new Date().toISOString().split("T")[0];

  // Use RPC (SECURITY DEFINER) — works for both authenticated and child sessions
  try {
    const { data, error } = await supabase.rpc("get_child_daily_missions", { p_profile_id: profileId, p_date: today });
    const missions = data as any;
    if (!error && missions && Array.isArray(missions) && missions.length > 0) return missions;
  } catch (e) {
    console.warn("get_child_daily_missions RPC error:", e);
  }

  // Fallback: direct query (authenticated parents only)
  const { data: existing } = await supabase
    .from("daily_missions")
    .select("*")
    .eq("child_profile_id", profileId)
    .eq("mission_date", today)
    .order("created_at");
  if (existing && existing.length > 0) return existing;

  // Fallback: call generate-missions edge function
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
        body: JSON.stringify({ childProfileId: profileId, lang: getCurrentLang() }),
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

  // Distribute mission points across categories based on mission type
  const current = await getGamification(profileId);
  if (current) {
    // Look up the mission to determine its type
    const { data: missionData } = await supabase
      .from("daily_missions")
      .select("mission_type")
      .eq("id", missionId)
      .single();

    const mType = missionData?.mission_type || "study_session";
    let focusAdd = 0;
    let autonomyAdd = 0;
    let consistencyAdd = 0;

    // Split points by mission type
    switch (mType) {
      case "complete_task":
        // 20 pts → 10 focus + 10 autonomy
        focusAdd = Math.min(pointsReward, 10);
        autonomyAdd = Math.max(0, pointsReward - 10);
        break;
      case "coach_challenge":
        // 20 pts → 10 focus + 10 autonomy
        focusAdd = Math.min(pointsReward, 10);
        autonomyAdd = Math.max(0, pointsReward - 10);
        break;
      case "review_weak_concept":
        // 15 pts → 10 focus + 5 consistency
        focusAdd = Math.min(pointsReward, 10);
        consistencyAdd = Math.max(0, pointsReward - 10);
        break;
      case "study_session":
      default:
        // 15 pts → 10 focus + 5 autonomy
        focusAdd = Math.min(pointsReward, 10);
        autonomyAdd = Math.max(0, pointsReward - 10);
        break;
    }

    await supabase.from("gamification").update({
      focus_points: (current.focus_points || 0) + focusAdd,
      autonomy_points: (current.autonomy_points || 0) + autonomyAdd,
      consistency_points: (current.consistency_points || 0) + consistencyAdd,
      updated_at: new Date().toISOString(),
    }).eq("child_profile_id", profileId);
  }
}

/**
 * Auto-complete matching missions by type.
 * Call after a study action (flashcards, review, session, etc.)
 */
export async function autoCompleteMissions(matchTypes: string[]) {
  try {
    const missions = await getDailyMissions();
    for (const mission of missions) {
      if (mission.completed) continue;
      if (matchTypes.includes(mission.mission_type)) {
        await completeMission(mission.id, mission.points_reward);
      }
    }
  } catch (err) {
    console.error("autoCompleteMissions error:", err);
  }
}


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
        body: JSON.stringify({ childProfileId: profileId, lang: getCurrentLang() }),
      }
    );
  } catch (err) {
    console.error("Emotional analysis trigger error:", err);
  }
}

// ============ IMAGE UPLOAD ============

export async function uploadHomeworkImage(file: File): Promise<string | null> {
  if (isChildSession()) {
    try {
      const base64 = await fileToBase64(file);
      const result = await childApi("upload-homework-image", {
        base64,
        fileName: file.name,
        contentType: file.type,
      });
      return result?.publicUrl || null;
    } catch (err) {
      console.error("Child upload error:", err);
      return null;
    }
  }

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============ OCR ============

export async function extractTasksFromImage(imageUrl: string | string[], sourceType: string, userNote?: string) {
  const imageUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ imageUrls, sourceType, userNote: userNote || undefined }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nell'analisi dell'immagine");
  }
  return response.json();
}
