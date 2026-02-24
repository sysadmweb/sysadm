-- Migration 25: Corrigir políticas RLS para UPDATE na tabela registros_trabalho
-- Garante que usuários autenticados possam inserir, atualizar e excluir registros

-- Remover policies existentes que possam estar bloqueando UPDATE
DROP POLICY IF EXISTS "Usuários autenticados podem inserir registros_trabalho" ON registros_trabalho;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar registros_trabalho" ON registros_trabalho;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir registros_trabalho" ON registros_trabalho;
DROP POLICY IF EXISTS "Usuários autenticados podem ver registros_trabalho" ON registros_trabalho;

-- Habilitar RLS se ainda não estiver habilitada
ALTER TABLE registros_trabalho ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - qualquer usuário autenticado pode ver os registros
CREATE POLICY "Usuarios autenticados podem ver registros_trabalho"
ON registros_trabalho
FOR SELECT
TO authenticated
USING (true);

-- Policy: INSERT - qualquer usuário autenticado pode inserir registros
CREATE POLICY "Usuarios autenticados podem inserir registros_trabalho"
ON registros_trabalho
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: UPDATE - qualquer usuário autenticado pode atualizar registros
CREATE POLICY "Usuarios autenticados podem atualizar registros_trabalho"
ON registros_trabalho
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: DELETE - qualquer usuário autenticado pode excluir registros
CREATE POLICY "Usuarios autenticados podem excluir registros_trabalho"
ON registros_trabalho
FOR DELETE
TO authenticated
USING (true);
