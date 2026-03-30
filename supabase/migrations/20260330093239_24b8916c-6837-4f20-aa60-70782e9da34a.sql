
-- Fix search_path on validate_profile_age function
CREATE OR REPLACE FUNCTION public.validate_profile_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_age integer;
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.date_of_birth))::integer;
  ELSE
    v_age := NEW.age;
  END IF;

  IF v_age IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.school_level IN ('primaria-1-2', 'primaria-3-5', 'media-1', 'media-2', 'media-3') AND v_age < 6 THEN
    RAISE EXCEPTION 'Età minima 6 anni per creare un profilo studente';
  END IF;

  IF NEW.school_level IN ('superiori', 'universitario') AND v_age < 14 THEN
    RAISE EXCEPTION 'Età minima 14 anni per questo livello scolastico';
  END IF;

  IF NEW.school_level = 'docente' AND v_age < 18 THEN
    RAISE EXCEPTION 'Età minima 18 anni per registrarsi come docente';
  END IF;

  RETURN NEW;
END;
$$;
