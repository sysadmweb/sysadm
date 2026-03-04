-- Migration: Add fornecedor_id to alojamentos table
ALTER TABLE public.alojamentos
ADD COLUMN fornecedor_id BIGINT REFERENCES public.fornecedores(id);

-- Update updated_at on change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
