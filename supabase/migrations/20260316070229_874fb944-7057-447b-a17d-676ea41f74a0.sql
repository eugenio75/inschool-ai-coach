
CREATE TABLE public.daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  mission_date date NOT NULL DEFAULT CURRENT_DATE,
  mission_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  points_reward integer NOT NULL DEFAULT 10,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_profile_id, mission_date, mission_type)
);

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage children missions" ON public.daily_missions
  FOR ALL TO authenticated
  USING (owns_child_profile(child_profile_id))
  WITH CHECK (owns_child_profile(child_profile_id));
