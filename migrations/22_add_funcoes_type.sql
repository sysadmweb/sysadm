ALTER TABLE funcoes 
ADD COLUMN type text CHECK (type IN ('MOI', 'MOD'));
