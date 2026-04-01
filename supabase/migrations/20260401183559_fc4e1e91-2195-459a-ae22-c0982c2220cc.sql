
CREATE OR REPLACE FUNCTION public.get_student_classes(student_profile_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      cp.last_name as teacher_last_name,
      cp.gender as teacher_gender,
      ce.enrolled_at
    FROM public.class_enrollments ce
    JOIN public.classi c ON c.id = ce.class_id
    JOIN public.child_profiles cp ON cp.id = c.docente_profile_id
    WHERE ce.student_id = student_profile_id AND ce.status = 'active'
    ORDER BY ce.enrolled_at DESC
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_class_by_code(code text, student_profile_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_class record;
  v_existing record;
  v_teacher record;
BEGIN
  SELECT * INTO v_class
  FROM public.classi
  WHERE codice_invito = upper(trim(code));

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_existing
  FROM public.class_enrollments
  WHERE class_id = v_class.id AND student_id = student_profile_id;

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'already_enrolled');
  END IF;

  SELECT name, last_name, gender INTO v_teacher
  FROM public.child_profiles
  WHERE id = v_class.docente_profile_id;

  INSERT INTO public.class_enrollments (class_id, student_id, status)
  VALUES (v_class.id, student_profile_id, 'active');

  RETURN json_build_object(
    'success', true,
    'class_name', v_class.nome,
    'subject', v_class.materia,
    'teacher_name', v_teacher.name,
    'teacher_last_name', v_teacher.last_name,
    'teacher_gender', v_teacher.gender
  );
END;
$function$;
