CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);

-- Insert default values if they don't exist
INSERT INTO config (key, value, description)
VALUES 
    ('meal_target_days', '0', 'Quantidade de dias planejados para Vale Refeição'),
    ('meal_stock', '0', 'Quantidade de Vales Refeição em estoque')
ON CONFLICT (key) DO NOTHING;
