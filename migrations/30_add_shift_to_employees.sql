-- Migration 30: Add shift to employees
ALTER TABLE public.employees ADD COLUMN shift TEXT DEFAULT 'Manhã';

-- Optional: Add a comment to describe the column
COMMENT ON COLUMN public.employees.shift IS 'Turno do colaborador (Manhã, Noite)';
