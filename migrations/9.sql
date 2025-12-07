-- Add integration_date column to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS integration_date DATE;

-- Ensure statuses exist
INSERT INTO statuses (name, is_active)
SELECT 'AGUARDANDO INTEGRAÇÃO', true
WHERE NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'AGUARDANDO INTEGRAÇÃO');

INSERT INTO statuses (name, is_active)
SELECT 'TRABALHANDO DISPONIVEL', true
WHERE NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'TRABALHANDO DISPONIVEL');
