
ALTER TABLE public.classi ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.teacher_materials ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
