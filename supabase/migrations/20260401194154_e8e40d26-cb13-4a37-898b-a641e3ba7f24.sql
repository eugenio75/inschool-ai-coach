
-- Create schools table
CREATE TABLE public.schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codice_meccanografico text UNIQUE NOT NULL,
  denominazione text NOT NULL,
  comune text,
  provincia text,
  regione text,
  tipo_scuola text,
  indirizzo text,
  created_at timestamp with time zone DEFAULT now()
);

-- Search indexes
CREATE INDEX schools_denominazione_idx ON public.schools (denominazione text_pattern_ops);
CREATE INDEX schools_comune_idx ON public.schools (comune text_pattern_ops);

-- RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schools are publicly readable" ON public.schools FOR SELECT USING (true);

-- Search function
CREATE OR REPLACE FUNCTION public.search_schools(query text, limit_n int DEFAULT 10)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text)
LANGUAGE sql STABLE AS $$
  SELECT s.codice_meccanografico, s.denominazione, s.comune, s.provincia, s.tipo_scuola
  FROM public.schools s
  WHERE s.denominazione ILIKE '%' || query || '%'
     OR s.comune ILIKE '%' || query || '%'
  ORDER BY
    CASE WHEN s.denominazione ILIKE query || '%' THEN 0 ELSE 1 END,
    s.denominazione
  LIMIT limit_n;
$$;

-- Get discoverable teachers function
CREATE OR REPLACE FUNCTION public.get_discoverable_teachers(school_code_param text)
RETURNS TABLE(teacher_id uuid, name text, last_name text, badge text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    cp.id as teacher_id,
    cp.name,
    cp.last_name,
    CASE
      WHEN (up.data->>'email_istituzionale_verified')::text = 'true' THEN 'verified'
      WHEN (up.data->'teacher_declaration'->>'school_code') IS NOT NULL THEN 'school_recognized'
      ELSE 'unverified'
    END as badge
  FROM public.child_profiles cp
  JOIN public.user_preferences up ON up.profile_id = cp.id
  WHERE cp.school_level = 'docente'
    AND (up.data->>'discoverable')::text = 'true'
    AND up.data->'teacher_declaration'->>'school_code' = school_code_param;
$$;
