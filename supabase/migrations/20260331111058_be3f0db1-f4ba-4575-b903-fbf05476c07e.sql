
-- RPC to read gamification for a child profile (bypasses RLS for child sessions)
CREATE OR REPLACE FUNCTION public.get_child_gamification(p_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(g) INTO result
  FROM public.gamification g
  WHERE g.child_profile_id = p_profile_id;
  
  RETURN result;
END;
$$;

-- RPC to read daily missions for a child profile (bypasses RLS for child sessions)
CREATE OR REPLACE FUNCTION public.get_child_daily_missions(p_profile_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(m)) INTO result
  FROM (
    SELECT * FROM public.daily_missions
    WHERE child_profile_id = p_profile_id
      AND mission_date = p_date
    ORDER BY created_at
  ) m;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
