-- Migration: Create pivot table for many-to-many relationship between Accommodations and Suppliers
-- This replaces the previous single fornecedor_id column in the alojamentos table.

-- 1. Remove the old column (and its constraint) from alojamentos if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alojamentos' AND column_name='fornecedor_id') THEN
        ALTER TABLE public.alojamentos DROP COLUMN fornecedor_id;
    END IF;
END $$;

-- 2. Create the pivot table
CREATE TABLE IF NOT EXISTS public.alojamentos_fornecedores (
    alojamento_id BIGINT REFERENCES public.alojamentos(id) ON DELETE CASCADE,
    fornecedor_id BIGINT REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    PRIMARY KEY (alojamento_id, fornecedor_id)
);

-- 3. Enable RLS
ALTER TABLE public.alojamentos_fornecedores ENABLE ROW LEVEL SECURITY;

-- 4. Create policy (adjust based on your security needs, here we allow all for demo consistency)
CREATE POLICY "Enable all for anyone" ON public.alojamentos_fornecedores FOR ALL USING (true) WITH CHECK (true);
