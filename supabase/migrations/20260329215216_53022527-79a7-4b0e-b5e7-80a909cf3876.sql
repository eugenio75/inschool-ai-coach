
-- Function to join a class by invite code (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.join_class_by_code(code text, student_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_class record;
  v_existing record;
  v_teacher_name text;
BEGIN
  -- Find class by invite code
  SELECT * INTO v_class
  FROM public.classi
  WHERE codice_invito = upper(trim(code));

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Check if already enrolled
  SELECT * INTO v_existing
  FROM public.class_enrollments
  WHERE class_id = v_class.id AND student_id = student_profile_id;

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'already_enrolled');
  END IF;

  -- Get teacher name
  SELECT name INTO v_teacher_name
  FROM public.child_profiles
  WHERE id = v_class.docente_profile_id;

  -- Insert enrollment
  INSERT INTO public.class_enrollments (class_id, student_id, status)
  VALUES (v_class.id, student_profile_id, 'active');

  RETURN json_build_object(
    'success', true,
    'class_name', v_class.nome,
    'subject', v_class.materia,
    'teacher_name', v_teacher_name
  );
END;
$$;

-- Function to get enrolled classes for a student
CREATE OR REPLACE FUNCTION public.get_student_classes(student_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result
  FROM (
    SELECT
      ce.id as enrollment_id,
      ce.class_id,
      c.nome as class_name,
      c.materia as subject,
      cp.name as teacher_name,
      ce.enrolled_at
    FROM public.class_enrollments ce
    JOIN public.classi c ON c.id = ce.class_id
    JOIN public.child_profiles cp ON cp.id = c.docente_profile_id
    WHERE ce.student_id = student_profile_id AND ce.status = 'active'
    ORDER BY ce.enrolled_at DESC
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to leave a class
CREATE OR REPLACE FUNCTION public.leave_class(enrollment_id uuid, student_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.class_enrollments
  WHERE id = enrollment_id AND student_id = student_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false);
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
