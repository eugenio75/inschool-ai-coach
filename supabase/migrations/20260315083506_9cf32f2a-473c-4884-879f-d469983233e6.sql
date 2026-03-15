
-- Drop old tables that will be restructured (order matters for FK deps)
DROP TABLE IF EXISTS public.daily_missions CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.focus_sessions CASCADE;
DROP TABLE IF EXISTS public.memory_items CASCADE;
DROP TABLE IF EXISTS public.homework_tasks CASCADE;
DROP TABLE IF EXISTS public.gamification CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Child profiles table (linked to auth user = parent)
CREATE TABLE public.child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧒',
  age INTEGER,
  school_level TEXT,
  favorite_subjects TEXT[] DEFAULT '{}',
  difficult_subjects TEXT[] DEFAULT '{}',
  struggles TEXT[] DEFAULT '{}',
  focus_time INTEGER DEFAULT 15,
  support_style TEXT DEFAULT 'gentle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parent settings (PIN for parent area, etc.)
CREATE TABLE public.parent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  parent_pin TEXT DEFAULT '0000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Homework tasks (scoped to child profile)
CREATE TABLE public.homework_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  estimated_minutes INTEGER DEFAULT 15,
  difficulty INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  micro_steps JSONB DEFAULT '[]',
  key_concepts TEXT[] DEFAULT '{}',
  recall_questions TEXT[] DEFAULT '{}',
  source_type TEXT DEFAULT 'manual',
  source_image_url TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Focus sessions (scoped to child profile)
CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.homework_tasks(id) ON DELETE SET NULL,
  emotion TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  focus_points INTEGER DEFAULT 0,
  autonomy_points INTEGER DEFAULT 0,
  consistency_points INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memory items (scoped to child profile)
CREATE TABLE public.memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  summary TEXT DEFAULT '',
  recall_questions TEXT[] DEFAULT '{}',
  strength INTEGER DEFAULT 50,
  last_reviewed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gamification (scoped to child profile)
CREATE TABLE public.gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  focus_points INTEGER DEFAULT 0,
  consistency_points INTEGER DEFAULT 0,
  autonomy_points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badges (scoped to child profile)
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT DEFAULT '',
  quality TEXT NOT NULL,
  earned BOOLEAN DEFAULT false,
  earned_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- RLS: Parents can manage their own child profiles
CREATE POLICY "Parents manage own children" ON public.child_profiles
  FOR ALL TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- RLS: Parent settings
CREATE POLICY "Users manage own settings" ON public.parent_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Helper function: check if user owns a child profile
CREATE OR REPLACE FUNCTION public.owns_child_profile(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_profiles
    WHERE id = profile_id AND parent_id = auth.uid()
  );
$$;

-- RLS: Homework tasks - parent can manage tasks for their children
CREATE POLICY "Parents manage children tasks" ON public.homework_tasks
  FOR ALL TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- RLS: Focus sessions
CREATE POLICY "Parents manage children sessions" ON public.focus_sessions
  FOR ALL TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- RLS: Memory items
CREATE POLICY "Parents manage children memory" ON public.memory_items
  FOR ALL TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- RLS: Gamification
CREATE POLICY "Parents manage children gamification" ON public.gamification
  FOR ALL TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- RLS: Badges
CREATE POLICY "Parents manage children badges" ON public.badges
  FOR ALL TO authenticated
  USING (public.owns_child_profile(child_profile_id))
  WITH CHECK (public.owns_child_profile(child_profile_id));

-- Auto-create parent settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.parent_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
