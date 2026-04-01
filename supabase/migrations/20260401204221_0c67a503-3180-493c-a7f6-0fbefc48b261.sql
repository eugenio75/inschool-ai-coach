
CREATE OR REPLACE FUNCTION public.search_cities(query text, limit_n int DEFAULT 10)
RETURNS TABLE(comune text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT c.comune FROM (
    SELECT DISTINCT s.comune
    FROM public.schools s
    WHERE s.comune ILIKE '%' || query || '%'
  ) c
  ORDER BY
    CASE WHEN c.comune ILIKE query || '%' THEN 0 ELSE 1 END,
    c.comune
  LIMIT limit_n;
$$;

CREATE OR REPLACE FUNCTION public.search_schools(query text, city_filter text DEFAULT NULL, limit_n int DEFAULT 10)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT s.codice_meccanografico, s.denominazione, s.comune, s.provincia, s.tipo_scuola
  FROM public.schools s
  WHERE (city_filter IS NULL OR s.comune ILIKE city_filter)
    AND (s.denominazione ILIKE '%' || query || '%')
  ORDER BY
    CASE WHEN s.denominazione ILIKE query || '%' THEN 0 ELSE 1 END,
    s.denominazione
  LIMIT limit_n;
$$;
