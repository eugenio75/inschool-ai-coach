CREATE TABLE public.parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  alert_level text NOT NULL DEFAULT 'concern',
  title text NOT NULL,
  message text NOT NULL,
  link_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parents_own_notifications" ON public.parent_notifications
  FOR ALL TO authenticated
  USING (child_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (child_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));