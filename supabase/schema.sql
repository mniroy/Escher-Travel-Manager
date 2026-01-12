-- ==============================================
-- Supabase Database Schema for Escher Travel Manager
-- ==============================================
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- TRIPS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 7,
    cover_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- EVENTS TABLE (Timeline Items)
-- ==============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Transport', 'Stay', 'Eat', 'Play')),
    title TEXT NOT NULL,
    time TEXT NOT NULL,
    end_time TEXT,
    description TEXT,
    rating DECIMAL(2,1),
    reviews INTEGER,
    image TEXT,
    status TEXT DEFAULT 'Scheduled',
    duration TEXT,
    google_maps_link TEXT,
    travel_time TEXT,
    travel_mode TEXT CHECK (travel_mode IN ('drive', 'walk', 'transit')),
    congestion TEXT,
    place_id TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address TEXT,
    opening_hours TEXT[],
    is_start BOOLEAN DEFAULT FALSE,
    is_end BOOLEAN DEFAULT FALSE,
    day_offset INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by trip
CREATE INDEX IF NOT EXISTS idx_events_trip_id ON events(trip_id);
CREATE INDEX IF NOT EXISTS idx_events_day_offset ON events(trip_id, day_offset);

-- ==============================================
-- DOCUMENTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Transport', 'Accommodation', 'Identity', 'Finance', 'Other')),
    size TEXT,
    mime_type TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by trip
CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id);

-- ==============================================
-- AUTO-UPDATE TIMESTAMP FUNCTION
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================
-- For now, allow all access (no auth required)
-- Enable RLS but allow public access

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Allow all access to trips" ON trips;
DROP POLICY IF EXISTS "Allow all access to events" ON events;
DROP POLICY IF EXISTS "Allow all access to documents" ON documents;

-- Allow all operations for anon users (you and your wife)
CREATE POLICY "Allow all access to trips" ON trips FOR ALL USING (true);
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true);
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true);

-- ==============================================
-- ENABLE REALTIME
-- ==============================================
-- This allows real-time subscriptions for live sync between devices
-- Using DO block to handle case where tables are already in publication

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication, ignore
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication, ignore
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication, ignore
END;
$$;

-- ==============================================
-- INSERT DEFAULT DATA
-- ==============================================
-- Insert a default trip so the app has data on first load

INSERT INTO trips (id, name, start_date, duration, cover_image) 
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Bali Trip',
    '2024-08-21',
    9,
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80'
) ON CONFLICT (id) DO NOTHING;

-- Insert default events for the trip
INSERT INTO events (trip_id, type, title, time, description, day_offset, duration, sort_order) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Transport', 'Arrive at Zurich International Airport', '03:00 PM', 'Terminal 1, Flight LX180', 0, '45m', 1),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Eat', 'Elfrentes Roasting', '04:00 PM', 'Specialty coffee roaster with light bites.', 0, '1h 30m', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Play', 'Spend the day exploring Zurich', '05:00 PM', 'Old Town, Lake Zurich, and Bahnhofstrasse.', 0, '3h', 3),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Eat', 'Elmira fine dining', '07:00 PM', 'Modern Swiss cuisine.', 0, '2h', 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Stay', 'BVLGARI Hotel', '07:45 PM', 'Check-in confirmed.', 0, NULL, 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Eat', 'Cafe Odeon', '09:00 AM', 'Historic Art Nouveau café.', 1, '1h', 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Play', 'Kunsthaus Zürich', '11:00 AM', 'Visit the art museum.', 1, '2h 15m', 7)
ON CONFLICT DO NOTHING;
