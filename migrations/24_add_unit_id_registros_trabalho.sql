-- Migration 24: Adicionar coluna unit_id na tabela registros_trabalho
-- Isso permite filtrar jornadas por unidade do usuário logado

ALTER TABLE registros_trabalho
  ADD COLUMN IF NOT EXISTS unit_id BIGINT REFERENCES unidades(id);

-- Popular registros existentes com o unit_id do funcionário vinculado
UPDATE registros_trabalho rt
SET unit_id = f.unit_id
FROM funcionarios f
WHERE rt.employee_id = f.id
  AND rt.unit_id IS NULL;
