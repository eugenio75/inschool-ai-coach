import { supabase } from "@/integrations/supabase/client";
import { childApi } from "@/lib/childSession";

export async function getCoachName(profileId: string, isChild: boolean) {
  if (!profileId) return "";

  if (isChild) {
    const prefs = await childApi("get-user-preferences");
    return (prefs as Record<string, any> | null)?.coach_name || "";
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("data")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data?.data as Record<string, any> | null)?.coach_name || "";
}

export async function saveCoachName(profileId: string, coachName: string, isChild: boolean) {
  if (!profileId) return;

  const normalizedCoachName = coachName.trim() || null;

  if (isChild) {
    await childApi("save-user-preferences", { coach_name: normalizedCoachName });
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_preferences")
    .select("data, role, current_step")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existingError) throw existingError;

  const mergedData = {
    ...((existing?.data as Record<string, any> | null) || {}),
    coach_name: normalizedCoachName,
  };

  const { error: upsertError } = await supabase
    .from("user_preferences")
    .upsert(
      {
        profile_id: profileId,
        role: existing?.role || null,
        current_step: existing?.current_step ?? 0,
        data: mergedData,
      },
      { onConflict: "profile_id" },
    );

  if (upsertError) throw upsertError;
}