
ALTER TABLE public.manual_grades
ADD COLUMN ai_proposed_grade text,
ADD COLUMN teacher_confirmed boolean DEFAULT true,
ADD COLUMN source text DEFAULT 'manual';
