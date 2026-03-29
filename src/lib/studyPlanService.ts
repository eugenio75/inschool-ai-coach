import { supabase } from "@/integrations/supabase/client";
import type { StudyPlanExam } from "@/components/UniversityStudyPlan";

export async function loadStudyPlan(profileId: string): Promise<StudyPlanExam[]> {
  try {
    const { data } = await supabase.from("user_preferences")
      .select("data").eq("profile_id", profileId).maybeSingle();
    const prefData = data?.data as any;
    if (prefData?.piano_studi && Array.isArray(prefData.piano_studi)) {
      return prefData.piano_studi;
    }
  } catch (err) {
    console.error("Failed to load study plan:", err);
  }
  return [];
}

export async function saveStudyPlan(profileId: string, newPlan: StudyPlanExam[]): Promise<void> {
  try {
    const { data: existing } = await supabase.from("user_preferences")
      .select("data").eq("profile_id", profileId).maybeSingle();
    const existingData = (existing?.data as any) || {};
    const merged = { ...existingData, piano_studi: newPlan };
    await supabase.from("user_preferences").upsert({
      profile_id: profileId,
      data: merged,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
  } catch (err) {
    console.error("Failed to save study plan:", err);
  }
}
