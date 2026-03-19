-- Migration to add onboarding_completed column for Phase 4 Intelligent Routing

ALTER TABLE child_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
