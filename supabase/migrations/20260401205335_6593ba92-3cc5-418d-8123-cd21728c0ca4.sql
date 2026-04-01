CREATE OR REPLACE FUNCTION public.search_schools(query text, city_filter text DEFAULT NULL, limit_n integer DEFAULT 10)
RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT s.codice_meccanografico, s.denominazione, INITCAP(s.comune) AS comune, s.provincia, s.tipo_scuola
  FROM public.schools s
  WHERE (city_filter IS NULL OR s.comune ILIKE city_filter)
    AND (s.denominazione ILIKE '%' || query || '%')
  ORDER BY
    CASE WHEN s.denominazione ILIKE query || '%' THEN 0 ELSE 1 END,
    s.denominazione
  LIMIT limit_n;
$$;