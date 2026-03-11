-- Migration 31: Add shift and team to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN shift TEXT DEFAULT 'Manhã';
ALTER TABLE public.funcionarios ADD COLUMN team TEXT;

-- Optional: Add comments to describe the columns
COMMENT ON COLUMN public.funcionarios.shift IS 'Turno do colaborador (Manhã, Tarde, Noite)';
COMMENT ON COLUMN public.funcionarios.team IS 'Nome da equipe assigned ao colaborador';
