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