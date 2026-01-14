-- Add metadata column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB;
