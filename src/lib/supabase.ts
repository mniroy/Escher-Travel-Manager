// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// ==============================================
// Type Definitions (matching database schema)
// ==============================================

export interface DbTrip {
    id: string;
    name: string;
    start_date: string;
    duration: number;
    cover_image: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbEvent {
    id: string;
    trip_id: string;
    type: 'Transport' | 'Stay' | 'Eat' | 'Play';
    title: string;
    time: string;
    end_time: string | null;
    description: string | null;
    rating: number | null;
    reviews: number | null;
    image: string | null;
    status: string | null;
    duration: string | null;
    google_maps_link: string | null;
    travel_time: string | null;
    travel_distance: string | null;
    travel_mode: 'drive' | 'walk' | 'transit' | null;
    day_offset: number;
    sort_order: number;
    congestion: string | null;
    place_id: string | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
    parking_buffer: number | null;
    opening_hours: string[] | null;
    is_start?: boolean | null;
    is_end?: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface DbDocument {
    id: string;
    trip_id: string;
    title: string;
    category: 'Transport' | 'Accommodation' | 'Identity' | 'Finance' | 'Other';
    size: string | null;
    mime_type: string | null;
    file_url: string | null;
    metadata: any | null;
    created_at: string;
    updated_at: string;
}

export interface DbHistory {
    id: string;
    trip_id: string;
    action_type: 'add' | 'update' | 'delete' | 'move';
    event_title: string;
    event_data: any;
    comment: string | null;
    created_at: string;
}

// ==============================================
// Database Operations
// ==============================================

export const db = {
    // ---- Trips ----
    async getTrips(): Promise<DbTrip[]> {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getTrip(id: string): Promise<DbTrip | null> {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createTrip(trip: Partial<DbTrip> & { name: string; start_date: string; duration: number }): Promise<DbTrip> {
        const { data, error } = await supabase
            .from('trips')
            .insert(trip)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateTrip(id: string, updates: Partial<DbTrip>): Promise<DbTrip> {
        const { data, error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteTrip(id: string): Promise<void> {
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // ---- Events ----
    async getEvents(tripId: string): Promise<DbEvent[]> {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('trip_id', tripId)
            .order('day_offset', { ascending: true })
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async createEvent(event: Omit<DbEvent, 'id' | 'created_at' | 'updated_at'>): Promise<DbEvent> {
        const { data, error } = await supabase
            .from('events')
            .insert(event)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateEvent(id: string, updates: Partial<DbEvent>): Promise<DbEvent> {
        const { data, error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async upsertEvents(events: DbEvent[]): Promise<DbEvent[]> {
        const { data, error } = await supabase
            .from('events')
            .upsert(events, { onConflict: 'id' })
            .select();

        if (error) throw error;
        return data || [];
    },

    async deleteEvent(id: string): Promise<void> {
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // ---- Documents ----
    async getDocuments(tripId: string): Promise<DbDocument[]> {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createDocument(doc: Omit<DbDocument, 'id' | 'created_at' | 'updated_at'>): Promise<DbDocument> {
        const { data, error } = await supabase
            .from('documents')
            .insert(doc)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteDocument(id: string): Promise<void> {
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // ---- History ----
    async getHistory(tripId: string): Promise<DbHistory[]> {
        const { data, error } = await supabase
            .from('trip_history')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createHistoryRecord(record: Omit<DbHistory, 'id' | 'created_at'>): Promise<DbHistory> {
        const { data, error } = await supabase
            .from('trip_history')
            .insert(record)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateHistoryComment(id: string, comment: string): Promise<DbHistory> {
        const { data, error } = await supabase
            .from('trip_history')
            .update({ comment })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },
};

// ==============================================
// Real-time Subscriptions
// ==============================================

export type RealtimeCallback<T> = (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T | null;
    old: T | null;
}) => void;

export function subscribeToTrips(callback: RealtimeCallback<DbTrip>) {
    return supabase
        .channel('trips-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trips' },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
                callback({
                    eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                    new: payload.new as unknown as DbTrip | null,
                    old: payload.old as unknown as DbTrip | null,
                });
            }
        )
        .subscribe();
}

export function subscribeToEvents(tripId: string, callback: RealtimeCallback<DbEvent>) {
    return supabase
        .channel(`events-${tripId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'events',
                filter: `trip_id=eq.${tripId}`
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
                callback({
                    eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                    new: payload.new as unknown as DbEvent | null,
                    old: payload.old as unknown as DbEvent | null,
                });
            }
        )
        .subscribe();
}

// ==============================================
// Utility: Check connection status
// ==============================================

export async function checkSupabaseConnection(): Promise<boolean> {
    try {
        const { error } = await supabase.from('trips').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
}
