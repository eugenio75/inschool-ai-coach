CREATE OR REPLACE FUNCTION public.validate_child_code(code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile record;
BEGIN
  SELECT * INTO profile 
  FROM public.child_profiles 
  WHERE access_code = upper(trim(code));
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'profile', json_build_object(
      'id', profile.id,
      'name', profile.name,
      'age', profile.age,
      'avatar_emoji', profile.avatar_emoji,
      'school_level', profile.school_level,
      'favorite_subjects', profile.favorite_subjects,
      'difficult_subjects', profile.difficult_subjects,
      'struggles', profile.struggles,
      'focus_time', profile.focus_time,
      'support_style', profile.support_style,
      'interests', profile.interests
    )
  );
END;
$function$;