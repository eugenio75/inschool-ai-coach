
-- MODIFICA: Feature 1 - Storage bucket for profile photo uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-avatars', 'profile-avatars', true);

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-avatars');

-- Allow public read access to avatars
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-avatars');

-- Allow users to update their own avatar
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-avatars');

-- Allow users to delete their own avatar
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-avatars');
