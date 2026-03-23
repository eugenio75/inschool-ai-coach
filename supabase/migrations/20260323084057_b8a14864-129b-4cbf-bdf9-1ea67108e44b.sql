CREATE TABLE IF NOT EXISTS class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classi(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  enrolled_at timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  UNIQUE(class_id, student_id)
);

CREATE TABLE IF NOT EXISTS teacher_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES classi(id),
  title text NOT NULL,
  subject text,
  type text,
  level text,
  target_profile text,
  content text NOT NULL,
  status text DEFAULT 'draft',
  assigned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES classi(id),
  student_id uuid,
  type text,
  severity text DEFAULT 'info',
  message text NOT NULL,
  action_label text,
  action_route text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parent_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid,
  class_id uuid REFERENCES classi(id),
  student_id uuid,
  type text,
  subject text,
  body text NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'draft'
);

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_materials" ON teacher_materials
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "teacher_own_feed" ON teacher_activity_feed
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "teacher_own_comms" ON parent_communications
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "student_own_enrollments" ON class_enrollments
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "teacher_sees_class_enrollments" ON class_enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM classi WHERE id = class_id AND docente_profile_id IN (
      SELECT cp.id FROM child_profiles cp WHERE cp.parent_id = auth.uid()
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM classi WHERE id = class_id AND docente_profile_id IN (
      SELECT cp.id FROM child_profiles cp WHERE cp.parent_id = auth.uid()
    ))
  );