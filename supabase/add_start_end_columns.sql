-- Add is_start and is_end columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_start BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_end BOOLEAN DEFAULT FALSE;
