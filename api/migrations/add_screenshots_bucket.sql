-- Run in Supabase SQL Editor
-- Creates the screenshots storage bucket and access policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "screenshots_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Allow service role write
CREATE POLICY "screenshots_service_write"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots');
