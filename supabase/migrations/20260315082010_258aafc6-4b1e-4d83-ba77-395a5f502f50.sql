
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  school_level TEXT,
  favorite_subjects TEXT[] DEFAULT '{}',
  difficult_subjects TEXT[] DEFAULT '{}',
  struggles TEXT[] DEFAULT '{}',
  focus_time INTEGER DEFAULT 15,
  support_style TEXT DEFAULT 'gentle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Homework tasks table
CREATE TABLE public.homework_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

-- Focus sessions table
CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.homework_tasks(id) ON DELETE SET NULL,
  emotion TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  focus_points INTEGER DEFAULT 0,
  autonomy_points INTEGER DEFAULT 0,
  consistency_points INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memory/recap items table
CREATE TABLE public.memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  summary TEXT DEFAULT '',
  recall_questions TEXT[] DEFAULT '{}',
  strength INTEGER DEFAULT 50,
  last_reviewed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gamification table
CREATE TABLE public.gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  focus_points INTEGER DEFAULT 0,
  consistency_points INTEGER DEFAULT 0,
  autonomy_points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT DEFAULT '',
  quality TEXT NOT NULL,
  earned BOOLEAN DEFAULT false,
  earned_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily missions table
CREATE TABLE public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  points INTEGER DEFAULT 10,
  mission_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage bucket for homework images
INSERT INTO storage.buckets (id, name, public) VALUES ('homework-images', 'homework-images', true);

-- RLS: All tables are open for now (no auth yet - using user_id from localStorage)
-- When auth is added, these will be restricted to authenticated users

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

-- Open policies for MVP (will be locked down with auth later)
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on homework_tasks" ON public.homework_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on focus_sessions" ON public.focus_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on memory_items" ON public.memory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on gamification" ON public.gamification FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on badges" ON public.badges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daily_missions" ON public.daily_missions FOR ALL USING (true) WITH CHECK (true);

-- Storage policies
CREATE POLICY "Allow public read on homework-images" ON storage.objects FOR SELECT USING (bucket_id = 'homework-images');
CREATE POLICY "Allow public insert on homework-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'homework-images');
CREATE POLICY "Allow public delete on homework-images" ON storage.objects FOR DELETE USING (bucket_id = 'homework-images');
