-- Adicionar colunas tamanho_marmita e restricao_alimentar na tabela funcionarios
    ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS tamanho_marmita TEXT;
    ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS restricao_alimentar TEXT;

-- O campo marmita_size não existe na tabela (baseado na investigação), mas se existisse e fosse renomeado, seria:
-- ALTER TABLE funcionarios RENAME COLUMN marmita_size TO tamanho_marmita;
-- Como parece que ele só existia no código React e não no DB, a criação acima é suficiente.
