-- Add unique constraint for upsert support
ALTER TABLE public.assignment_results
ADD CONSTRAINT assignment_results_assignment_student_unique
UNIQUE (assignment_id, student_id);
