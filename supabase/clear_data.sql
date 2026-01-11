-- ==============================================
-- CLEAR ALL DATA FROM ESCHER TRAVEL MANAGER
-- ==============================================
-- Run this in Supabase SQL Editor to remove all dummy data

-- Delete all events first (due to foreign key constraint)
DELETE FROM events;

-- Delete all documents
DELETE FROM documents;

-- Delete all trips
DELETE FROM trips;

-- Verify tables are empty
SELECT 'trips' as table_name, COUNT(*) as count FROM trips
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'documents', COUNT(*) FROM documents;
