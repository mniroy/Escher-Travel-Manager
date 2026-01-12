-- Add opening_hours column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS opening_hours TEXT[]; 

-- Comment
COMMENT ON COLUMN events.opening_hours IS 'Array of opening hours strings from Google Places API';
