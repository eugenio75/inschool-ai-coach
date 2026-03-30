
CREATE TABLE public.teacher_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reports" ON public.teacher_reports
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "No public read" ON public.teacher_reports
  FOR SELECT TO authenticated
  USING (false);
