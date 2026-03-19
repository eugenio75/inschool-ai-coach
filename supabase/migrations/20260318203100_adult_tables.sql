-- Migration: Adult Tables for InSchool Phase 4
-- Tables: sessioni_studio, esami_utente, classi, verifiche, ricerche_bibliografiche
-- All tied to child_profiles.id (profile_id / docente_profile_id) for consistency with existing schema

-- 1. SESSIONI DI STUDIO
CREATE TABLE IF NOT EXISTS public.sessioni_studio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  materia TEXT,
  durata_minuti INTEGER NOT NULL CHECK (durata_minuti > 0),
  tipo TEXT CHECK (tipo IN ('pomodoro','deep_work','ultra_focus','libero')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.sessioni_studio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessioni_studio_owner" ON public.sessioni_studio
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- 2. ESAMI UNIVERSITARI
CREATE TABLE IF NOT EXISTS public.esami_utente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  nome_esame TEXT NOT NULL,
  data_prevista DATE,
  completato BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.esami_utente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esami_utente_owner" ON public.esami_utente
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- 3. CLASSI DOCENTE
CREATE TABLE IF NOT EXISTS public.classi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  materia TEXT,
  ordine_scolastico TEXT,
  num_studenti INTEGER DEFAULT 0 NOT NULL,
  codice_invito TEXT UNIQUE DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.classi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classi_docente_owner" ON public.classi
  FOR ALL USING (
    docente_profile_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- 4. VERIFICHE DOCENTE
CREATE TABLE IF NOT EXISTS public.verifiche (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docente_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  materia TEXT,
  argomento TEXT NOT NULL,
  contenuto TEXT,
  tipo TEXT CHECK (tipo IN ('multipla','aperta','vero_falso','misto')),
  difficolta TEXT CHECK (difficolta IN ('facile','medio','difficile')),
  numero_domande INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.verifiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifiche_docente_owner" ON public.verifiche
  FOR ALL USING (
    docente_profile_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- 5. RICERCHE BIBLIOGRAFICHE (universitari)
CREATE TABLE IF NOT EXISTS public.ricerche_bibliografiche (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
  argomento TEXT NOT NULL,
  risultati JSONB DEFAULT '[]'::jsonb,
  num_fonti INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ricerche_bibliografiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ricerche_bib_owner" ON public.ricerche_bibliografiche
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );
