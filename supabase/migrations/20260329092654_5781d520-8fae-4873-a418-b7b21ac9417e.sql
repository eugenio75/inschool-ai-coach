CREATE TABLE IF NOT EXISTS public.translation_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lang text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lang, key)
);
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read translations" ON public.translation_cache FOR SELECT USING (true);
CREATE POLICY "Anon insert translations" ON public.translation_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update translations" ON public.translation_cache FOR UPDATE USING (true);