CREATE OR REPLACE FUNCTION public.get_discoverable_teachers_with_classes(school_code_param text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT 
      cp.id as teacher_id,
      cp.name,
      cp.last_name,
      cp.gender,
      CASE
        WHEN (up.data->>'email_istituzionale_verified')::text = 'true' THEN 'verified'
        WHEN (up.data->'teacher_declaration'->>'school_code') IS NOT NULL THEN 'school_recognized'
        ELSE 'unverified'
      END as badge,
      COALESCE((
        SELECT json_agg(json_build_object(
          'class_id', c.id,
          'class_name', c.nome,
          'subject', c.materia,
          'invite_code', c.codice_invito
        ))
        FROM public.classi c
        WHERE c.docente_profile_id = cp.id
          AND c.is_sample = false
          AND c.codice_invito IS NOT NULL
      ), '[]'::json) as classes
    FROM public.child_profiles cp
    JOIN public.user_preferences up ON up.profile_id = cp.id
    WHERE cp.school_level = 'docente'
      AND (up.data->>'discoverable')::text = 'true'
      AND up.data->'teacher_declaration'->>'school_code' = school_code_param
  ) r;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;