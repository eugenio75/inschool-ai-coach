
CREATE TABLE IF NOT EXISTS public.teacher_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES public.classi(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'nota',
  event_date date NOT NULL,
  event_time time,
  duration_minutes integer,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_events" ON public.teacher_calendar_events
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);
