-- Migration to fix user_id type in devolucoes table
-- Run this if you already created the table with the wrong type (UUID).

DO $$
BEGIN
    -- Check if the column exists and is of type uuid before attempting to change
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'devolucoes' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Drop the referencing constraint if strictly necessary, usually drop column handles it or cascade
        -- Altering the column type is hard if data exists and can't cast. 
        -- Since data is likely empty or invalid, we drop and re-add.
        ALTER TABLE devolucoes DROP COLUMN user_id;
        ALTER TABLE devolucoes ADD COLUMN user_id bigint REFERENCES usuarios(id);
    ELSE
        -- If column is already bigint or doesn't exist, ensure it exists as bigint
        ALTER TABLE devolucoes DROP COLUMN IF EXISTS user_id;
        ALTER TABLE devolucoes ADD COLUMN user_id bigint REFERENCES usuarios(id);
    END IF;
END $$;
