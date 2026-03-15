
-- Add access_code column to child_profiles
ALTER TABLE public.child_profiles 
  ADD COLUMN IF NOT EXISTS access_code text UNIQUE;

-- Function to generate a random fun code like "LUNA42", "STAR78", etc.
CREATE OR REPLACE FUNCTION public.generate_child_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  words text[] := ARRAY['LUNA', 'STAR', 'SOLE', 'GATTO', 'ORSO', 'TIGRE', 'AQUILA', 'DELFINO', 'PANDA', 'VOLPE', 'DRAGO', 'FALCO', 'GUFO', 'KOALA', 'LUPO', 'LEONE'];
  code text;
  attempts int := 0;
BEGIN
  LOOP
    code := words[1 + floor(random() * array_length(words, 1))::int] || floor(10 + random() * 90)::int::text;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.child_profiles WHERE access_code = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique code';
    END IF;
  END LOOP;
END;
$$;

-- Auto-generate code for existing profiles that don't have one
UPDATE public.child_profiles 
SET access_code = public.generate_child_access_code() 
WHERE access_code IS NULL;

-- Function to validate child access code (security definer, no auth needed)
CREATE OR REPLACE FUNCTION public.validate_child_code(code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'support_style', profile.support_style
    )
  );
END;
$$;
