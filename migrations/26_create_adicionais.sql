CREATE TABLE public.adicionais (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  quantidade_marmita NUMERIC NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar o campo atualizado_em
CREATE TRIGGER set_adicionais_atualizado_em
BEFORE UPDATE ON public.adicionais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para todos os usuários autenticados"
ON public.adicionais FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir inserção para super usuários"
ON public.adicionais FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()::text::bigint -- Ajuste conforme o tipo de id do auth
    AND users.is_super_user = true
  )
);

-- Nota: Como o sistema parece gerenciar permissões via tabela permissoes_usuario no frontend/backend,
-- as políticas de RLS aqui são básicas e podem precisar de ajuste fino se o sistema usar RLS estrito.
