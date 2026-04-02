-- Add school_code and school_name columns to classi table
ALTER TABLE public.classi ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE public.classi ADD COLUMN IF NOT EXISTS school_name text;

-- Update get_discoverable_teachers to search across teacher schools array
CREATE OR REPLACE FUNCTION public.get_discoverable_teachers(school_code_param text)
 RETURNS TABLE(teacher_id uuid, name text, last_name text, badge text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    cp.id as teacher_id,
    cp.name,
    cp.last_name,
    CASE
      WHEN (up.data->>'email_istituzionale_verified')::text = 'true' THEN 'verified'
      WHEN (up.data->'teacher_declaration'->>'school_code') IS NOT NULL THEN 'school_recognized'
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          COALESCE(up.data->'teacher_declaration'->'schools', '[]'::jsonb)
        ) AS s
        WHERE s->>'school_code' IS NOT NULL
      ) THEN 'school_recognized'
      ELSE 'unverified'
    END as badge
  FROM public.child_profiles cp
  JOIN public.user_preferences up ON up.profile_id = cp.id
  WHERE cp.school_level = 'docente'
    AND (up.data->>'discoverable')::text = 'true'
    AND (
      up.data->'teacher_declaration'->>'school_code' = school_code_param
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          COALESCE(up.data->'teacher_declaration'->'schools', '[]'::jsonb)
        ) AS s
        WHERE s->>'school_code' = school_code_param
      )
    );
$$;

-- Update get_discoverable_teachers_with_classes similarly
CREATE OR REPLACE FUNCTION public.get_discoverable_teachers_with_classes(school_code_param text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(up.data->'teacher_declaration'->'schools', '[]'::jsonb)
          ) AS s2
          WHERE s2->>'school_code' IS NOT NULL
        ) THEN 'school_recognized'
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
      AND (
        up.data->'teacher_declaration'->>'school_code' = school_code_param
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(up.data->'teacher_declaration'->'schools', '[]'::jsonb)
          ) AS s
          WHERE s->>'school_code' = school_code_param
        )
      )
  ) r;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;