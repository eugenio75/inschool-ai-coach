
-- Table for student-uploaded materials (PDF, images, slides, etc.)
CREATE TABLE public.student_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'pdf',
  material_type text NOT NULL DEFAULT 'pdf',
  subject text NOT NULL,
  title text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_student_materials" ON public.student_materials
  FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Table for material favorites
CREATE TABLE public.material_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  material_id text NOT NULL,
  material_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, material_id, material_type)
);

ALTER TABLE public.material_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_material_favorites" ON public.material_favorites
  FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Storage bucket for student materials
INSERT INTO storage.buckets (id, name, public) VALUES ('student-materials', 'student-materials', true);

CREATE POLICY "students_upload_materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-materials');

CREATE POLICY "students_read_materials" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'student-materials');
