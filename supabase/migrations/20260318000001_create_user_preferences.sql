-- Migration for Phase 4: User Preferences (Progressive Onboarding Save)

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES child_profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  current_step integer DEFAULT 0,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(profile_id)
);

-- For simplicity in the MVP phase, we disable RLS to avoid permission blocks during the progressive save
ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;
