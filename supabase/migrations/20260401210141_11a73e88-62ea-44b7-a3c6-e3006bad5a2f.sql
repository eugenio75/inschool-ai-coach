
CREATE OR REPLACE FUNCTION public.search_schools(query text, city_filter text DEFAULT NULL, limit_n integer DEFAULT 10)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT s.codice_meccanografico, 
         INITCAP(s.denominazione) AS denominazione, 
         INITCAP(s.comune) AS comune, 
         s.provincia, 
         s.tipo_scuola
  FROM public.schools s
  WHERE (city_filter IS NULL OR s.comune ILIKE city_filter)
    AND (
      s.denominazione ILIKE '%' || query || '%'
      OR s.denominazione ILIKE '%' || regexp_replace(query, '\s+', '%', 'g') || '%'
    )
  ORDER BY
    CASE WHEN s.denominazione ILIKE query || '%' THEN 0
         WHEN s.denominazione ILIKE '%' || query || '%' THEN 1
         ELSE 2 END,
    s.denominazione
  LIMIT limit_n;
$$;

CREATE OR REPLACE FUNCTION public.search_cities(query text, limit_n integer DEFAULT 10)
RETURNS TABLE(comune text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT c.comune FROM (
    SELECT DISTINCT INITCAP(s.comune) AS comune
    FROM public.schools s
    WHERE s.comune ILIKE '%' || query || '%'
      AND s.comune IS NOT NULL
      AND s.comune != ''
  ) c
  ORDER BY
    CASE WHEN c.comune ILIKE query || '%' THEN 0 ELSE 1 END,
    c.comune
  LIMIT limit_n;
$$;
