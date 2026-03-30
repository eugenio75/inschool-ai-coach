
-- 1. Create user_consents table for GDPR accountability (Art. 5.2)
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  privacy_accepted boolean NOT NULL DEFAULT false,
  privacy_accepted_at timestamptz,
  tos_accepted boolean NOT NULL DEFAULT false,
  tos_accepted_at timestamptz,
  parental_consent boolean,
  parental_consent_at timestamptz,
  marketing_consent boolean DEFAULT false,
  marketing_consent_at timestamptz,
  age_at_registration integer,
  role_at_registration text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consents" ON public.user_consents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Add date_of_birth column to child_profiles
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

-- 3. Validation trigger for age requirements (server-side enforcement)
CREATE OR REPLACE FUNCTION public.validate_profile_age()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_age integer;
BEGIN
  -- Calculate age from DOB if available, otherwise use age field
  IF NEW.date_of_birth IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.date_of_birth))::integer;
  ELSE
    v_age := NEW.age;
  END IF;

  -- Skip validation if no age info provided
  IF v_age IS NULL THEN
    RETURN NEW;
  END IF;

  -- Minimum 6 years for child profiles (elementari/medie)
  IF NEW.school_level IN ('primaria-1-2', 'primaria-3-5', 'media-1', 'media-2', 'media-3') AND v_age < 6 THEN
    RAISE EXCEPTION 'Età minima 6 anni per creare un profilo studente';
  END IF;

  -- Minimum 14 for superiori/universitario
  IF NEW.school_level IN ('superiori', 'universitario') AND v_age < 14 THEN
    RAISE EXCEPTION 'Età minima 14 anni per questo livello scolastico';
  END IF;

  -- Minimum 18 for docente
  IF NEW.school_level = 'docente' AND v_age < 18 THEN
    RAISE EXCEPTION 'Età minima 18 anni per registrarsi come docente';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_profile_age_trigger
  BEFORE INSERT OR UPDATE ON public.child_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_age();
