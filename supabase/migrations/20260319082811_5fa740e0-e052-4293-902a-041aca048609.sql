
-- Add onboarding_completed to child_profiles
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- User preferences (onboarding data)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT,
  current_step INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_prefs" ON public.user_preferences FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Sessioni studio (superiori + universitario)
CREATE TABLE IF NOT EXISTS public.sessioni_studio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  materia TEXT,
  durata_minuti INTEGER NOT NULL,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sessioni_studio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_sessioni" ON public.sessioni_studio FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Esami utente (universitario)
CREATE TABLE IF NOT EXISTS public.esami_utente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  nome_esame TEXT NOT NULL,
  data_prevista DATE,
  completato BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.esami_utente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_esami" ON public.esami_utente FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Ricerche bibliografiche (universitario)
CREATE TABLE IF NOT EXISTS public.ricerche_bibliografiche (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  argomento TEXT NOT NULL,
  risultati JSONB DEFAULT '[]'::jsonb,
  num_fonti INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ricerche_bibliografiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_ricerche" ON public.ricerche_bibliografiche FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Classi (docente)
CREATE TABLE IF NOT EXISTS public.classi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  materia TEXT,
  ordine_scolastico TEXT,
  num_studenti INTEGER DEFAULT 0,
  codice_invito TEXT UNIQUE DEFAULT upper(substring(md5(random()::text), 1, 6)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.classi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_classi" ON public.classi FOR ALL TO authenticated
  USING (docente_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (docente_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Verifiche (docente)
CREATE TABLE IF NOT EXISTS public.verifiche (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  materia TEXT,
  argomento TEXT NOT NULL,
  contenuto TEXT,
  tipo TEXT,
  difficolta TEXT,
  numero_domande INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.verifiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_verifiche" ON public.verifiche FOR ALL TO authenticated
  USING (docente_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (docente_profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));

-- Conversation sessions (AI chat memory)
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  titolo TEXT,
  materia TEXT,
  ruolo_utente TEXT,
  messaggi JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_conversations" ON public.conversation_sessions FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()));
