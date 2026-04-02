CREATE POLICY "parent_sees_child_enrollments"
ON public.class_enrollments
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
  )
);