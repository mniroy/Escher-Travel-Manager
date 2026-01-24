-- Create trip_history table to track changes and deletions
CREATE TABLE IF NOT EXISTS public.trip_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'delete', 'update', 'add'
    event_title TEXT NOT NULL,
    event_data JSONB, -- Snapshot of the event before change
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;

-- Create policy for all users (Simplified for this app)
CREATE POLICY "Enable all access for all users" ON public.trip_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_trip_history_trip_id ON public.trip_history(trip_id);
