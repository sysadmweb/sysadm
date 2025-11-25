-- 1. Create or Update Inspections Table
CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  accommodation_id INTEGER NOT NULL REFERENCES accommodations(id),
  employee_id INTEGER REFERENCES employees(id),
  inspection_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'REALIZADO',
  observations TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns if they don't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspections' AND column_name = 'photo_url') THEN
        ALTER TABLE inspections ADD COLUMN photo_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspections' AND column_name = 'title') THEN
        ALTER TABLE inspections ADD COLUMN title VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspections' AND column_name = 'user_id') THEN
        ALTER TABLE inspections ADD COLUMN user_id INTEGER REFERENCES users(id);
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inspections_accommodation ON inspections(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);

-- 2. Setup Storage for Photos
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies (Drop first to avoid errors if they exist, or use DO block)
DROP POLICY IF EXISTS "Authenticated users can upload inspection photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload inspection photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'inspection-photos' );

DROP POLICY IF EXISTS "Public can view inspection photos" ON storage.objects;
CREATE POLICY "Public can view inspection photos"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'inspection-photos' );
