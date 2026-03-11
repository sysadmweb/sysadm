-- Adicionar políticas de UPDATE e DELETE para adicionais
CREATE POLICY "Permitir atualização para super usuários"
ON public.adicionais FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()::text::bigint
    AND users.is_super_user = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()::text::bigint
    AND users.is_super_user = true
  )
);

CREATE POLICY "Permitir exclusão para super usuários"
ON public.adicionais FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()::text::bigint
    AND users.is_super_user = true
  )
);
