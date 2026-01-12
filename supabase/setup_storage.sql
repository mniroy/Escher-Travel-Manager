-- ==========================================================
-- SUPABASE STORAGE SETUP FOR trip_docs (PUBLIC)
-- ==========================================================

-- 1. Create the 'trip_docs' bucket as PUBLIC
-- public = true means files ARE accessible via standard public URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip_docs', 'trip_docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup old policies
DROP POLICY IF EXISTS "Allow Public Access to trip_docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow Anon Access to trip_docs" ON storage.objects;

-- 4. Create Policy for Public Access
-- Allows Read, Write, Delete for everyone (inc. anon)
CREATE POLICY "Allow Public Access to trip_docs"
ON storage.objects
FOR ALL
USING ( bucket_id = 'trip_docs' )
WITH CHECK ( bucket_id = 'trip_docs' );

-- ==========================================================
-- VERIFICATION
-- ==========================================================
-- 1. Go to Storage > trip_docs > Configuration. "Public Bucket" should be ON.
-- 2. App can use getPublicUrl() to show images.
