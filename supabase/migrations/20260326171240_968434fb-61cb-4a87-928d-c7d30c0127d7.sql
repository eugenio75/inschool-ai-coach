-- Enable realtime for daily_missions
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_missions;

-- Trigger: auto-complete missions when a homework_task is marked completed
CREATE OR REPLACE FUNCTION public.auto_complete_missions_on_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when task goes from incomplete to completed
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    -- Complete "complete_task" missions for this child today
    UPDATE public.daily_missions
    SET completed = true, completed_at = NOW()
    WHERE child_profile_id = NEW.child_profile_id
      AND mission_date = CURRENT_DATE
      AND completed = false
      AND mission_type = 'complete_task';

    -- Also complete "study_session" missions (completing a task counts as a study session)
    UPDATE public.daily_missions
    SET completed = true, completed_at = NOW()
    WHERE child_profile_id = NEW.child_profile_id
      AND mission_date = CURRENT_DATE
      AND completed = false
      AND mission_type = 'study_session';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_completed
  AFTER UPDATE ON public.homework_tasks
  FOR EACH ROW
  WHEN (NEW.completed = true AND (OLD.completed IS DISTINCT FROM true))
EXECUTE FUNCTION public.auto_complete_missions_on_task();

-- Trigger: auto-complete missions when a guided session is completed
CREATE OR REPLACE FUNCTION public.auto_complete_missions_on_guided_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_profile_id uuid;
BEGIN
  -- Only fire when session status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Find the child_profile_id from the homework task
    SELECT ht.child_profile_id INTO v_child_profile_id
    FROM public.homework_tasks ht
    WHERE ht.id = NEW.homework_id;

    IF v_child_profile_id IS NOT NULL THEN
      -- Complete study_session and complete_task missions
      UPDATE public.daily_missions
      SET completed = true, completed_at = NOW()
      WHERE child_profile_id = v_child_profile_id
        AND mission_date = CURRENT_DATE
        AND completed = false
        AND mission_type IN ('study_session', 'complete_task');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_guided_session_completed
  AFTER UPDATE ON public.guided_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
EXECUTE FUNCTION public.auto_complete_missions_on_guided_session();

-- Trigger: auto-complete missions when a focus session is recorded
CREATE OR REPLACE FUNCTION public.auto_complete_missions_on_focus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Any new focus session completes study_session missions
  UPDATE public.daily_missions
  SET completed = true, completed_at = NOW()
  WHERE child_profile_id = NEW.child_profile_id
    AND mission_date = CURRENT_DATE
    AND completed = false
    AND mission_type IN ('study_session', 'complete_task');

  -- If duration >= 600 seconds (10 min), complete study_minutes missions
  IF NEW.duration_seconds >= 600 THEN
    UPDATE public.daily_missions
    SET completed = true, completed_at = NOW()
    WHERE child_profile_id = NEW.child_profile_id
      AND mission_date = CURRENT_DATE
      AND completed = false
      AND mission_type = 'study_minutes';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_focus_session_inserted
  AFTER INSERT ON public.focus_sessions
  FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_missions_on_focus();