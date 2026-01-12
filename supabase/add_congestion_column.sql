-- Add congestion column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS congestion TEXT;
