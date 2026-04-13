CREATE TABLE public.manual_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classi(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_id uuid,
  assignment_id uuid REFERENCES public.teacher_assignments(id) ON DELETE SET NULL,
  assignment_title text,
  grade text NOT NULL,
  grade_scale text NOT NULL DEFAULT '/10',
  notes text,
  graded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_manual_grades"
ON public.manual_grades
FOR ALL
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);