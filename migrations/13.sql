-- Add observation column to work_logs
ALTER TABLE public.work_logs
ADD COLUMN IF NOT EXISTS observation TEXT;
