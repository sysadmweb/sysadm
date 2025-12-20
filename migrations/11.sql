-- Migration 11: Add transferred_to_unit_id and transferred_arrival_date columns to track destination unit and arrival time during transfers
-- This allows us to see:
-- - Origin unit (unit_id before transfer)
-- - Destination unit (transferred_to_unit_id)
-- - Departure date/time (departure_date)
-- - Arrival date/time (transferred_arrival_date)

-- Add transferred_to_unit_id column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transferred_to_unit_id BIGINT;

-- Add transferred_arrival_date column to track arrival at destination
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transferred_arrival_date TIMESTAMP WITH TIME ZONE;

-- Add foreign key constraint to units table
ALTER TABLE employees 
ADD CONSTRAINT fk_employees_transferred_to_unit 
FOREIGN KEY (transferred_to_unit_id) 
REFERENCES units(id)
ON DELETE SET NULL;

-- Add comments to explain the column purposes
COMMENT ON COLUMN employees.transferred_to_unit_id IS 
'Stores the destination unit ID when an employee is transferred. The unit_id field will be updated to the new unit, while this field preserves the transfer destination for historical tracking.';

COMMENT ON COLUMN employees.transferred_arrival_date IS 
'Stores the date and time when the employee arrived at the destination unit during a transfer. Works together with departure_date (exit time) to track the complete transfer timeline.';

-- Optional indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_employees_transferred_to_unit_id ON employees(transferred_to_unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_transferred_arrival_date ON employees(transferred_arrival_date);
