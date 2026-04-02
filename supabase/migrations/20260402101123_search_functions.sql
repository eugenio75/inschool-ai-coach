DROP FUNCTION IF EXISTS public.search_cities(text, integer);
CREATE OR REPLACE FUNCTION public.search_cities(query text, limit_n int DEFAULT 10)
RETURNS TABLE(comune text, provincia text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT comune, provincia
  FROM public.schools
  WHERE lower(comune) ILIKE lower(query) || '%'
  ORDER BY comune
  LIMIT limit_n;
$$;

DROP FUNCTION IF EXISTS public.search_schools(text, integer);
CREATE OR REPLACE FUNCTION public.search_schools(query text, limit_n int DEFAULT 20, city_filter text DEFAULT NULL)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text, indirizzo text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT s.codice_meccanografico, s.denominazione, s.comune, s.provincia, s.tipo_scuola, s.indirizzo
  FROM public.schools s
  WHERE (city_filter IS NULL OR lower(s.comune) ILIKE lower(city_filter) || '%')
    AND (s.denominazione ILIKE '%' || query || '%' OR s.comune ILIKE '%' || query || '%')
  ORDER BY
    CASE WHEN lower(s.comune) ILIKE lower(COALESCE(city_filter,'')) || '%' THEN 0 ELSE 1 END,
    CASE WHEN lower(s.denominazione) ILIKE lower(query) || '%' THEN 0 ELSE 1 END,
    s.denominazione
  LIMIT limit_n;
$$;
