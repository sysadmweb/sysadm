-- Add refeicao_status_id column to employees and set default to OBRA (10)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS refeicao_status_id BIGINT;

-- Set default to 10 (OBRA)
ALTER TABLE employees ALTER COLUMN refeicao_status_id SET DEFAULT 10;

-- Backfill existing records with default if null
UPDATE employees SET refeicao_status_id = 10 WHERE refeicao_status_id IS NULL;

-- Ensure status 'ALOJAMENTO' exists
INSERT INTO statuses (name, is_active)
SELECT 'ALOJAMENTO', true
WHERE NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'ALOJAMENTO');

-- Optional index to speed up filtering by refeicao_status_id
CREATE INDEX IF NOT EXISTS idx_employees_refeicao_status_id ON employees(refeicao_status_id);

