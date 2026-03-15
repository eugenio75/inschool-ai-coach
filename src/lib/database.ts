import { supabase } from "@/integrations/supabase/client";

// Helper to get or create a user_id for MVP (no auth yet)
export function getUserId(): string {
  let userId = localStorage.getItem("inschool-user-id");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("inschool-user-id", userId);
  }
  return userId;
}

// ============ PROFILES ============

export async function getProfile() {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) console.error("getProfile error:", error);
  return data;
}

export async function upsertProfile(profile: {
  name: string;
  age?: number;
  school_level?: string;
  favorite_subjects?: string[];
  difficult_subjects?: string[];
  struggles?: string[];
  focus_time?: number;
  support_style?: string;
}) {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, ...profile, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) console.error("upsertProfile error:", error);
  
  // Keep localStorage in sync for quick access
  localStorage.setItem("inschool-profile", JSON.stringify({
    name: profile.name,
    age: profile.age,
    schoolLevel: profile.school_level,
    favoriteSubjects: profile.favorite_subjects,
    difficultSubjects: profile.difficult_subjects,
    struggles: profile.struggles,
    focusTime: profile.focus_time?.toString() || "15",
    supportStyle: profile.support_style,
  }));
  
  return data;
}

// ============ HOMEWORK TASKS ============

export async function getTasks() {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("homework_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) console.error("getTasks error:", error);
  return data || [];
}

export async function getTask(taskId: string) {
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
}) {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("homework_tasks")
    .insert({ user_id: userId, ...task })
    .select()
    .single();
  if (error) console.error("createTask error:", error);
  return data;
}

export async function updateTask(taskId: string, updates: Record<string, any>) {
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
  const { error } = await supabase
    .from("homework_tasks")
    .delete()
    .eq("id", taskId);
  if (error) console.error("deleteTask error:", error);
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
  const userId = getUserId();
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({ user_id: userId, ...session })
    .select()
    .single();
  if (error) console.error("saveFocusSession error:", error);

  // Update gamification
  if (data) {
    await updateGamificationPoints(
      session.focus_points || 0,
      session.autonomy_points || 0,
      session.consistency_points || 0
    );
  }

  return data;
}

export async function getFocusSessions() {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });
  if (error) console.error("getFocusSessions error:", error);
  return data || [];
}

// ============ GAMIFICATION ============

export async function getGamification() {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("gamification")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) console.error("getGamification error:", error);
  
  if (!data) {
    // Create initial gamification record
    const { data: created, error: createErr } = await supabase
      .from("gamification")
      .insert({ user_id: userId })
      .select()
      .single();
    if (createErr) console.error("createGamification error:", createErr);
    return created;
  }
  
  return data;
}

async function updateGamificationPoints(focus: number, autonomy: number, consistency: number) {
  const userId = getUserId();
  const current = await getGamification();
  if (!current) return;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = current.last_activity_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  
  let newStreak = current.streak || 0;
  if (lastDate === yesterday) newStreak += 1;
  else if (lastDate !== today) newStreak = 1;

  const { error } = await supabase
    .from("gamification")
    .update({
      focus_points: (current.focus_points || 0) + focus,
      autonomy_points: (current.autonomy_points || 0) + autonomy,
      consistency_points: (current.consistency_points || 0) + consistency,
      streak: newStreak,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) console.error("updateGamification error:", error);
}

// ============ MEMORY ITEMS ============

export async function getMemoryItems() {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("memory_items")
    .select("*")
    .eq("user_id", userId)
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
  const userId = getUserId();
  const { data, error } = await supabase
    .from("memory_items")
    .insert({ user_id: userId, ...item })
    .select()
    .single();
  if (error) console.error("createMemoryItem error:", error);
  return data;
}

export async function updateMemoryStrength(itemId: string, strength: number) {
  const { error } = await supabase
    .from("memory_items")
    .update({ strength, last_reviewed: new Date().toISOString() })
    .eq("id", itemId);
  if (error) console.error("updateMemoryStrength error:", error);
}

// ============ IMAGE UPLOAD ============

export async function uploadHomeworkImage(file: File): Promise<string | null> {
  const fileName = `${getUserId()}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from("homework-images")
    .upload(fileName, file);

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("homework-images")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ============ OCR ============

export async function extractTasksFromImage(imageUrl: string, sourceType: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ imageUrl, sourceType }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nell'analisi dell'immagine");
  }

  return response.json();
}
