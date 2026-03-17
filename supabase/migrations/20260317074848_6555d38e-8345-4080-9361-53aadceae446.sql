
-- Emotional check-ins table
CREATE TABLE public.emotional_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_tone TEXT DEFAULT 'neutral',
  energy_level TEXT DEFAULT 'medium',
  signals TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(child_profile_id, checkin_date)
);

ALTER TABLE public.emotional_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage children checkins"
  ON public.emotional_checkins FOR ALL
  TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- Emotional alerts table (for parents)
CREATE TABLE public.emotional_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL DEFAULT 'low',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  pattern_data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.emotional_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage children alerts"
  ON public.emotional_alerts FOR ALL
  TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));
