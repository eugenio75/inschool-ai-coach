ALTER TABLE public.gamification 
ADD COLUMN IF NOT EXISTS streak_shields integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_shield_at integer DEFAULT 7;