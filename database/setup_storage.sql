-- Enable the storage extension if not already enabled (usually enabled by default)
-- create extension if not exists "storage";

-- Create the bucket 'inspection-photos' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload inspection photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'inspection-photos' );

-- Policy to allow public to view inspection photos (since bucket is public)
CREATE POLICY "Public can view inspection photos"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'inspection-photos' );

-- Policy to allow authenticated users to update/delete their own uploads (optional but good practice)
-- Assuming we want to allow deletion if needed
CREATE POLICY "Authenticated users can update inspection photos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'inspection-photos' );

CREATE POLICY "Authenticated users can delete inspection photos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'inspection-photos' );
