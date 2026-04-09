
CREATE TABLE public.coach_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  score DOUBLE PRECISION DEFAULT 0,
  learned TEXT[] DEFAULT '{}',
  struggled TEXT[] DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage children coach_progress"
  ON public.coach_progress
  FOR ALL
  USING (public.owns_child_profile(user_id))
  WITH CHECK (public.owns_child_profile(user_id));

CREATE INDEX idx_coach_progress_user_subject ON public.coach_progress (user_id, subject);
