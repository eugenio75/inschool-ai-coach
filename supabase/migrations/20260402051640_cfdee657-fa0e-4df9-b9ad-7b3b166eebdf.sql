-- Drop both overloads
DROP FUNCTION IF EXISTS public.search_schools(text, integer);
DROP FUNCTION IF EXISTS public.search_schools(text, text, integer);

-- Recreate with indirizzo
CREATE FUNCTION public.search_schools(query text, city_filter text DEFAULT NULL::text, limit_n integer DEFAULT 10)
 RETURNS TABLE(codice_meccanografico text, denominazione text, comune text, provincia text, tipo_scuola text, indirizzo text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT s.codice_meccanografico, 
         INITCAP(s.denominazione) AS denominazione, 
         INITCAP(s.comune) AS comune, 
         s.provincia, 
         INITCAP(s.tipo_scuola) AS tipo_scuola,
         INITCAP(s.indirizzo) AS indirizzo
  FROM public.schools s
  WHERE (city_filter IS NULL OR s.comune ILIKE city_filter)
    AND (
      s.denominazione ILIKE '%' || query || '%'
      OR s.denominazione ILIKE '%' || UPPER(query) || '%'
      OR s.denominazione ILIKE '%' || regexp_replace(query, '\s+', '%', 'g') || '%'
    )
  ORDER BY s.comune, s.tipo_scuola, s.denominazione
  LIMIT limit_n;
$$;