
-- 1. Guided sessions
CREATE TABLE IF NOT EXISTS public.guided_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  homework_id uuid REFERENCES public.homework_tasks(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversation_sessions(id),
  status text DEFAULT 'active',
  current_step int DEFAULT 1,
  total_steps int,
  emotional_checkin text,
  bloom_level_reached int,
  last_difficulty text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 2. Study steps
CREATE TABLE IF NOT EXISTS public.study_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  homework_id uuid REFERENCES public.homework_tasks(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.guided_sessions(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  step_text text NOT NULL,
  status text DEFAULT 'pending',
  hint_count int DEFAULT 0,
  error_type text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Flashcards
CREATE TABLE IF NOT EXISTS public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  source_session_id uuid,
  difficulty int DEFAULT 1,
  times_shown int DEFAULT 0,
  times_correct int DEFAULT 0,
  times_wrong int DEFAULT 0,
  last_shown_at timestamptz,
  next_review_at timestamptz,
  is_flagged bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. Learning errors
CREATE TABLE IF NOT EXISTS public.learning_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text,
  topic text,
  error_type text,
  description text,
  resolved bool DEFAULT false,
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 5. Teacher assignments
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) NOT NULL,
  class_id uuid REFERENCES public.classi(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  type text NOT NULL,
  subject text,
  description text,
  due_date timestamptz,
  assigned_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- 6. Assignment results
CREATE TABLE IF NOT EXISTS public.assignment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.teacher_assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) NOT NULL,
  status text DEFAULT 'assigned',
  session_id uuid REFERENCES public.guided_sessions(id),
  answers jsonb DEFAULT '[]',
  score float,
  errors_summary jsonb DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.guided_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "users_own_guided_sessions" ON public.guided_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_study_steps" ON public.study_steps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_learning_errors" ON public.learning_errors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "teacher_sees_own_assignments" ON public.teacher_assignments FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "student_sees_assigned" ON public.teacher_assignments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "own_results" ON public.assignment_results FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
