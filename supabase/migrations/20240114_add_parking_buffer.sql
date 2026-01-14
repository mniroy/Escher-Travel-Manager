-- Add parking_buffer column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS parking_buffer INTEGER DEFAULT 10;
