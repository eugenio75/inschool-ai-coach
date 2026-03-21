ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS adaptive_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cognitive_dynamic_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS emotional_cognitive_correlation float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS bloom_level_current int DEFAULT 1,
ADD COLUMN IF NOT EXISTS mood_streak int DEFAULT 0;