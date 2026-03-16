ALTER TABLE public.child_profiles 
  ADD COLUMN class_section text DEFAULT NULL,
  ADD COLUMN school_name text DEFAULT NULL,
  ADD COLUMN city text DEFAULT NULL;