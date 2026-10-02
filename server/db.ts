import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'postgres://escher:escherpassword@localhost:5432/escher_travel';

let pool: pg.Pool | null = null;
let isConnected = false;

export function getPool(): pg.Pool {
    if (!pool) {
        pool = new Pool({
            connectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('[PostgreSQL] Unexpected error on idle client:', err);
        });
    }
    return pool;
}

export async function initDatabase(): Promise<boolean> {
    try {
        const client = await getPool().connect();
        console.log('[PostgreSQL] Connected successfully to database.');

        // Initialize schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS trips (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                duration INTEGER NOT NULL DEFAULT 7,
                cover_image TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                time TEXT NOT NULL,
                end_time TEXT,
                description TEXT,
                rating REAL,
                reviews INTEGER,
                image TEXT,
                status TEXT DEFAULT 'Scheduled',
                duration TEXT,
                google_maps_link TEXT,
                travel_time TEXT,
                travel_mode TEXT,
                day_offset INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                congestion TEXT,
                place_id TEXT,
                lat REAL,
                lng REAL,
                address TEXT,
                parking_buffer INTEGER DEFAULT 10,
                opening_hours TEXT,
                is_start BOOLEAN DEFAULT FALSE,
                is_end BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                size TEXT,
                mime_type TEXT,
                file_url TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trip_history (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL,
                event_title TEXT NOT NULL,
                event_data JSONB,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_events_trip_id ON events(trip_id);
            CREATE INDEX IF NOT EXISTS idx_events_day_offset ON events(trip_id, day_offset);
            CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id);
            CREATE INDEX IF NOT EXISTS idx_trip_history_trip_id ON trip_history(trip_id);
        `);

        // Check if trips exist, insert default if empty
        const countRes = await client.query('SELECT COUNT(*) FROM trips');
        const count = parseInt(countRes.rows[0].count, 10);
        if (count === 0) {
            console.log('[PostgreSQL] Database is empty. Seeding default Bali trip data...');
            const defaultTripId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
            await client.query(
                `INSERT INTO trips (id, name, start_date, duration, cover_image) 
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                [
                    defaultTripId,
                    'Bali Trip',
                    '2024-08-21',
                    9,
                    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80',
                ]
            );

            const sampleEvents = [
                ['e1', defaultTripId, 'Transport', 'Arrive at Zurich International Airport', '03:00 PM', 'Terminal 1, Flight LX180', 0, '45m', 1],
                ['e2', defaultTripId, 'Eat', 'Elfrentes Roasting', '04:00 PM', 'Specialty coffee roaster with light bites.', 0, '1h 30m', 2],
                ['e3', defaultTripId, 'Play', 'Spend the day exploring Zurich', '05:00 PM', 'Old Town, Lake Zurich, and Bahnhofstrasse.', 0, '3h', 3],
                ['e4', defaultTripId, 'Eat', 'Elmira fine dining', '07:00 PM', 'Modern Swiss cuisine.', 0, '2h', 4],
                ['e5', defaultTripId, 'Stay', 'BVLGARI Hotel', '07:45 PM', 'Check-in confirmed.', 0, null, 5],
                ['e6', defaultTripId, 'Eat', 'Cafe Odeon', '09:00 AM', 'Historic Art Nouveau café.', 1, '1h', 6],
                ['e7', defaultTripId, 'Play', 'Kunsthaus Zürich', '11:00 AM', 'Visit the art museum.', 1, '2h 15m', 7],
            ];

            for (const ev of sampleEvents) {
                await client.query(
                    `INSERT INTO events (id, trip_id, type, title, time, description, day_offset, duration, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
                    ev
                );
            }
        }

        client.release();
        isConnected = true;
        return true;
    } catch (err) {
        console.error('[PostgreSQL] Connection / initialization failed:', err);
        isConnected = false;
        return false;
    }
}

export function isDbConnected(): boolean {
    return isConnected;
}

// ====================================================
// Database Methods
// ====================================================

export const dbService = {
    // ---- Trips ----
    async getTrips(): Promise<DbTrip[]> {
        const pool = getPool();
        const res = await pool.query('SELECT * FROM trips ORDER BY created_at DESC');
        return res.rows;
    },

    async getTrip(id: string): Promise<DbTrip | null> {
        const pool = getPool();
        const res = await pool.query('SELECT * FROM trips WHERE id = $1', [id]);
        return res.rows[0] || null;
    },

    async createTrip(trip: Partial<DbTrip> & { id: string; name: string; start_date: string; duration: number }): Promise<DbTrip> {
        const pool = getPool();
        const res = await pool.query(
            `INSERT INTO trips (id, name, start_date, duration, cover_image)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [trip.id, trip.name, trip.start_date, trip.duration || 7, trip.cover_image || null]
        );
        return res.rows[0];
    },

    async updateTrip(id: string, updates: Partial<DbTrip>): Promise<DbTrip> {
        const pool = getPool();
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (updates.name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(updates.name);
        }
        if (updates.start_date !== undefined) {
            fields.push(`start_date = $${idx++}`);
            values.push(updates.start_date);
        }
        if (updates.duration !== undefined) {
            fields.push(`duration = $${idx++}`);
            values.push(updates.duration);
        }
        if (updates.cover_image !== undefined) {
            fields.push(`cover_image = $${idx++}`);
            values.push(updates.cover_image);
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        values.push(id);
        const query = `UPDATE trips SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const res = await pool.query(query, values);
        return res.rows[0];
    },

    async deleteTrip(id: string): Promise<void> {
        const pool = getPool();
        await pool.query('DELETE FROM trips WHERE id = $1', [id]);
    },

    // ---- Events ----
    async getEvents(tripId: string): Promise<DbEvent[]> {
        const pool = getPool();
        const res = await pool.query(
            'SELECT * FROM events WHERE trip_id = $1 ORDER BY day_offset ASC, sort_order ASC',
            [tripId]
        );
        return res.rows.map((row) => ({
            ...row,
            opening_hours: typeof row.opening_hours === 'string' ? JSON.parse(row.opening_hours) : row.opening_hours,
        }));
    },

    async createEvent(event: DbEvent): Promise<DbEvent> {
        const pool = getPool();
        const openingHoursJson = event.opening_hours ? JSON.stringify(event.opening_hours) : null;
        const res = await pool.query(
            `INSERT INTO events (
                id, trip_id, type, title, time, end_time, description, rating, reviews,
                image, status, duration, google_maps_link, travel_time, travel_mode,
                day_offset, sort_order, congestion, place_id, lat, lng, address,
                parking_buffer, opening_hours, is_start, is_end
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22,
                $23, $24, $25, $26
            ) RETURNING *`,
            [
                event.id, event.trip_id, event.type, event.title, event.time, event.end_time || null,
                event.description || null, event.rating || null, event.reviews || null,
                event.image || null, event.status || 'Scheduled', event.duration || null,
                event.google_maps_link || null, event.travel_time || null, event.travel_mode || null,
                event.day_offset || 0, event.sort_order || 0, event.congestion || null,
                event.place_id || null, event.lat || null, event.lng || null, event.address || null,
                event.parking_buffer || 10, openingHoursJson, event.is_start || false, event.is_end || false,
            ]
        );
        return res.rows[0];
    },

    async updateEvent(id: string, updates: Partial<DbEvent>): Promise<DbEvent> {
        const pool = getPool();
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        const allowedKeys = [
            'type', 'title', 'time', 'end_time', 'description', 'rating', 'reviews',
            'image', 'status', 'duration', 'google_maps_link', 'travel_time', 'travel_mode',
            'day_offset', 'sort_order', 'congestion', 'place_id', 'lat', 'lng', 'address',
            'parking_buffer', 'is_start', 'is_end'
        ];

        for (const key of allowedKeys) {
            if ((updates as any)[key] !== undefined) {
                fields.push(`${key} = $${idx++}`);
                values.push((updates as any)[key]);
            }
        }

        if (updates.opening_hours !== undefined) {
            fields.push(`opening_hours = $${idx++}`);
            values.push(updates.opening_hours ? JSON.stringify(updates.opening_hours) : null);
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query = `UPDATE events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const res = await pool.query(query, values);
        return res.rows[0];
    },

    async upsertEvents(events: DbEvent[]): Promise<DbEvent[]> {
        const results: DbEvent[] = [];
        for (const ev of events) {
            const pool = getPool();
            const exists = await pool.query('SELECT id FROM events WHERE id = $1', [ev.id]);
            if (exists.rows.length > 0) {
                const updated = await this.updateEvent(ev.id, ev);
                results.push(updated);
            } else {
                const created = await this.createEvent(ev);
                results.push(created);
            }
        }
        return results;
    },

    async deleteEvent(id: string): Promise<void> {
        const pool = getPool();
        await pool.query('DELETE FROM events WHERE id = $1', [id]);
    },

    // ---- Documents ----
    async getDocuments(tripId: string): Promise<DbDocument[]> {
        const pool = getPool();
        const res = await pool.query(
            'SELECT * FROM documents WHERE trip_id = $1 ORDER BY created_at DESC',
            [tripId]
        );
        return res.rows;
    },

    async createDocument(doc: Partial<DbDocument> & { id: string; trip_id: string; title: string; category: string }): Promise<DbDocument> {
        const pool = getPool();
        const res = await pool.query(
            `INSERT INTO documents (id, trip_id, title, category, size, mime_type, file_url, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                doc.id, doc.trip_id, doc.title, doc.category, doc.size || null,
                doc.mime_type || null, doc.file_url || null, doc.metadata ? JSON.stringify(doc.metadata) : null,
            ]
        );
        return res.rows[0];
    },

    async deleteDocument(id: string): Promise<DbDocument | null> {
        const pool = getPool();
        const res = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);
        return res.rows[0] || null;
    },

    // ---- History ----
    async getHistory(tripId: string): Promise<DbHistory[]> {
        const pool = getPool();
        const res = await pool.query(
            'SELECT * FROM trip_history WHERE trip_id = $1 ORDER BY created_at DESC',
            [tripId]
        );
        return res.rows;
    },

    async createHistoryRecord(record: Partial<DbHistory> & { id: string; trip_id: string; action_type: string; event_title: string }): Promise<DbHistory> {
        const pool = getPool();
        const res = await pool.query(
            `INSERT INTO trip_history (id, trip_id, action_type, event_title, event_data, comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                record.id, record.trip_id, record.action_type, record.event_title,
                record.event_data ? JSON.stringify(record.event_data) : null, record.comment || null,
            ]
        );
        return res.rows[0];
    },

    async updateHistoryComment(id: string, comment: string): Promise<DbHistory> {
        const pool = getPool();
        const res = await pool.query(
            'UPDATE trip_history SET comment = $1 WHERE id = $2 RETURNING *',
            [comment, id]
        );
        return res.rows[0];
    },
};
