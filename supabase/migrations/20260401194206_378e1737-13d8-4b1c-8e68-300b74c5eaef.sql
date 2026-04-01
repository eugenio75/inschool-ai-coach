
CREATE OR REPLACE FUNCTION public.search_schools(query text, limit_n int DEFAULT 10)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT s.codice_meccanografico, s.denominazione, s.comune, s.provincia, s.tipo_scuola
  FROM public.schools s
  WHERE s.denominazione ILIKE '%' || query || '%'
     OR s.comune ILIKE '%' || query || '%'
  ORDER BY
    CASE WHEN s.denominazione ILIKE query || '%' THEN 0 ELSE 1 END,
    s.denominazione
  LIMIT limit_n;
$$;
