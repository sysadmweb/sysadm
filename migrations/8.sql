-- Create cleaners table
CREATE TABLE IF NOT EXISTS cleaners (
    id bigserial PRIMARY KEY,
    arrival_date date,
    full_name text NOT NULL,
    cpf text,
    pix text,
    agreed_salary numeric(10, 2),
    observation text,
    user_id bigint REFERENCES users(id),
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cleaners_is_active ON cleaners(is_active);
CREATE INDEX IF NOT EXISTS idx_cleaners_full_name ON cleaners(full_name);
