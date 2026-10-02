// Self-Hosted API Client for Escher Travel Manager (Zero Cloud Dependency)

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
    travel_distance?: string | null;
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
// WebSocket Real-time Live Sync
// ==============================================

type RealtimeMessage = {
    table: 'trips' | 'events' | 'documents' | 'history';
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
};

const listeners = new Set<(event: RealtimeMessage) => void>();
let wsClient: WebSocket | null = null;
let reconnectTimer: any = null;

function getWebSocket() {
    if (typeof window === 'undefined') return null;
    if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
        return wsClient;
    }

    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        wsClient = new WebSocket(wsUrl);

        wsClient.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CHANGE') {
                    for (const listener of listeners) {
                        listener(data);
                    }
                }
            } catch (err) {
                console.error('[WebSocket] Message parse error:', err);
            }
        };

        wsClient.onclose = () => {
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    getWebSocket();
                }, 3000);
            }
        };

        wsClient.onerror = () => {
            wsClient?.close();
        };
    } catch (err) {
        console.warn('[WebSocket] Init error:', err);
    }

    return wsClient;
}

// ==============================================
// Local Storage / File Upload Client
// ==============================================

export const supabase = {
    storage: {
        from: (_bucketName: string) => ({
            upload: async (_fileName: string, file: File, _options?: any) => {
                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        return { data: null, error: new Error(err.error || 'Upload failed') };
                    }

                    const data = await res.json();
                    return { data, error: null };
                } catch (err) {
                    return { data: null, error: err instanceof Error ? err : new Error('Upload error') };
                }
            },
            getPublicUrl: (fileName: string) => {
                if (fileName.startsWith('/uploads/') || fileName.startsWith('http')) {
                    return { data: { publicUrl: fileName } };
                }
                return { data: { publicUrl: `/uploads/${fileName}` } };
            },
        }),
    },
};

// ==============================================
// Database Operations (Self-Hosted REST API)
// ==============================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    if (res.status === 204) return {} as T;
    return res.json();
}

export const db = {
    // ---- Trips ----
    async getTrips(): Promise<DbTrip[]> {
        return fetchJson<DbTrip[]>('/api/trips');
    },

    async getTrip(id: string): Promise<DbTrip | null> {
        try {
            return await fetchJson<DbTrip>(`/api/trips/${id}`);
        } catch {
            return null;
        }
    },

    async createTrip(trip: Partial<DbTrip> & { name: string; start_date: string; duration: number }): Promise<DbTrip> {
        return fetchJson<DbTrip>('/api/trips', {
            method: 'POST',
            body: JSON.stringify(trip),
        });
    },

    async updateTrip(id: string, updates: Partial<DbTrip>): Promise<DbTrip> {
        return fetchJson<DbTrip>(`/api/trips/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    async deleteTrip(id: string): Promise<void> {
        await fetchJson<void>(`/api/trips/${id}`, { method: 'DELETE' });
    },

    // ---- Events ----
    async getEvents(tripId: string): Promise<DbEvent[]> {
        return fetchJson<DbEvent[]>(`/api/events?tripId=${tripId}`);
    },

    async createEvent(event: Omit<DbEvent, 'created_at' | 'updated_at'>): Promise<DbEvent> {
        return fetchJson<DbEvent>('/api/events', {
            method: 'POST',
            body: JSON.stringify(event),
        });
    },

    async updateEvent(id: string, updates: Partial<DbEvent>): Promise<DbEvent> {
        return fetchJson<DbEvent>(`/api/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    async upsertEvents(events: DbEvent[]): Promise<DbEvent[]> {
        return fetchJson<DbEvent[]>('/api/events/batch', {
            method: 'POST',
            body: JSON.stringify(events),
        });
    },

    async deleteEvent(id: string): Promise<void> {
        await fetchJson<void>(`/api/events/${id}`, { method: 'DELETE' });
    },

    // ---- Documents ----
    async getDocuments(tripId: string): Promise<DbDocument[]> {
        return fetchJson<DbDocument[]>(`/api/documents?tripId=${tripId}`);
    },

    async createDocument(doc: Partial<DbDocument> & { trip_id: string; title: string; category: string }): Promise<DbDocument> {
        return fetchJson<DbDocument>('/api/documents', {
            method: 'POST',
            body: JSON.stringify(doc),
        });
    },

    async deleteDocument(id: string): Promise<void> {
        await fetchJson<void>('/api/delete-document', {
            method: 'POST',
            body: JSON.stringify({ documentId: id }),
        });
    },

    // ---- History ----
    async getHistory(tripId: string): Promise<DbHistory[]> {
        return fetchJson<DbHistory[]>(`/api/history?tripId=${tripId}`);
    },

    async createHistoryRecord(record: Omit<DbHistory, 'id' | 'created_at'>): Promise<DbHistory> {
        return fetchJson<DbHistory>('/api/history', {
            method: 'POST',
            body: JSON.stringify(record),
        });
    },

    async updateHistoryComment(id: string, comment: string): Promise<DbHistory> {
        return fetchJson<DbHistory>(`/api/history/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ comment }),
        });
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
    getWebSocket();
    const handler = (event: RealtimeMessage) => {
        if (event.table === 'trips') {
            callback({
                eventType: event.eventType,
                new: event.new,
                old: event.old,
            });
        }
    };
    listeners.add(handler);
    return {
        unsubscribe: () => listeners.delete(handler),
    };
}

export function subscribeToEvents(tripId: string, callback: RealtimeCallback<DbEvent>) {
    getWebSocket();
    const handler = (event: RealtimeMessage) => {
        if (event.table === 'events') {
            const matchesTrip = event.new?.trip_id === tripId || event.old?.trip_id === tripId;
            if (matchesTrip) {
                callback({
                    eventType: event.eventType,
                    new: event.new,
                    old: event.old,
                });
            }
        }
    };
    listeners.add(handler);
    return {
        unsubscribe: () => listeners.delete(handler),
    };
}

// ==============================================
// Utility: Check connection status
// ==============================================

export async function checkSupabaseConnection(): Promise<boolean> {
    try {
        const res = await fetch('/api/health');
        if (!res.ok) return false;
        const data = await res.json();
        return data.database === 'connected' || data.status === 'ok';
    } catch {
        return false;
    }
}
