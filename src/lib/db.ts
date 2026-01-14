// Database schema and IndexedDB wrapper for offline-first data persistence
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ============================================
// Type Definitions
// ============================================

export interface Trip {
    id: string;
    name: string;
    startDate: string; // ISO date string
    duration: number; // days
    coverImage: string;
    createdAt: string;
    updatedAt: string;
}

export interface TimelineEvent {
    id: string;
    tripId: string;
    type: 'Transport' | 'Stay' | 'Eat' | 'Play';
    title: string;
    time: string;
    endTime?: string;
    description?: string;
    rating?: number;
    reviews?: number;
    image?: string;
    status?: string;
    duration?: string;
    googleMapsLink?: string;
    travelTime?: string;
    travelMode?: 'drive' | 'walk' | 'transit';
    dayOffset: number;
    congestion?: string;
    parkingBuffer?: number;
    createdAt: string;
    updatedAt: string;
}

export interface Document {
    id: string;
    tripId: string;
    title: string;
    category: 'Transport' | 'Accommodation' | 'Identity' | 'Finance' | 'Other';
    size: string;
    mimeType: string;
    data?: string; // Base64 encoded file data for small files
    createdAt: string;
    updatedAt: string;
}

export interface SyncAction {
    id?: number;
    type: 'create' | 'update' | 'delete';
    entity: 'trip' | 'event' | 'document';
    entityId: string;
    data?: any;
    timestamp: string;
    synced: boolean;
}

// ============================================
// Database Schema
// ============================================

interface TravelDBSchema extends DBSchema {
    trips: {
        key: string;
        value: Trip;
    };
    events: {
        key: string;
        value: TimelineEvent;
        indexes: {
            'by-trip': string;
            'by-day': [string, number]; // [tripId, dayOffset]
        };
    };
    documents: {
        key: string;
        value: Document;
        indexes: {
            'by-trip': string;
            'by-category': string;
        };
    };
    syncQueue: {
        key: number;
        value: SyncAction;
        indexes: {
            'by-synced': number; // 0 = not synced, 1 = synced
        };
    };
    meta: {
        key: string;
        value: {
            key: string;
            value: any;
        };
    };
}

// ============================================
// Database Instance
// ============================================

const DB_NAME = 'escher-travel-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<TravelDBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<TravelDBSchema>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<TravelDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Trips store
            if (!db.objectStoreNames.contains('trips')) {
                db.createObjectStore('trips', { keyPath: 'id' });
            }

            // Events store with indexes
            if (!db.objectStoreNames.contains('events')) {
                const eventStore = db.createObjectStore('events', { keyPath: 'id' });
                eventStore.createIndex('by-trip', 'tripId');
                eventStore.createIndex('by-day', ['tripId', 'dayOffset']);
            }

            // Documents store with indexes
            if (!db.objectStoreNames.contains('documents')) {
                const docStore = db.createObjectStore('documents', { keyPath: 'id' });
                docStore.createIndex('by-trip', 'tripId');
                docStore.createIndex('by-category', 'category');
            }

            // Sync queue with auto-increment
            if (!db.objectStoreNames.contains('syncQueue')) {
                const syncStore = db.createObjectStore('syncQueue', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                syncStore.createIndex('by-synced', 'synced');
            }

            // Meta store for app settings
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
            }
        },
    });

    return dbInstance;
}

// ============================================
// Trip Operations
// ============================================

export async function getAllTrips(): Promise<Trip[]> {
    const db = await getDB();
    return db.getAll('trips');
}

export async function getTrip(id: string): Promise<Trip | undefined> {
    const db = await getDB();
    return db.get('trips', id);
}

export async function saveTrip(trip: Trip): Promise<void> {
    const db = await getDB();
    await db.put('trips', trip);
}

export async function deleteTrip(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['trips', 'events', 'documents'], 'readwrite');

    // Delete trip
    await tx.objectStore('trips').delete(id);

    // Delete associated events
    const eventIndex = tx.objectStore('events').index('by-trip');
    let eventCursor = await eventIndex.openCursor(id);
    while (eventCursor) {
        await eventCursor.delete();
        eventCursor = await eventCursor.continue();
    }

    // Delete associated documents
    const docIndex = tx.objectStore('documents').index('by-trip');
    let docCursor = await docIndex.openCursor(id);
    while (docCursor) {
        await docCursor.delete();
        docCursor = await docCursor.continue();
    }

    await tx.done;
}

// ============================================
// Event Operations
// ============================================

export async function getEventsByTrip(tripId: string): Promise<TimelineEvent[]> {
    const db = await getDB();
    return db.getAllFromIndex('events', 'by-trip', tripId);
}

export async function getEventsByDay(tripId: string, dayOffset: number): Promise<TimelineEvent[]> {
    const db = await getDB();
    return db.getAllFromIndex('events', 'by-day', [tripId, dayOffset]);
}

export async function getEvent(id: string): Promise<TimelineEvent | undefined> {
    const db = await getDB();
    return db.get('events', id);
}

export async function saveEvent(event: TimelineEvent): Promise<void> {
    const db = await getDB();
    await db.put('events', event);
}

export async function saveEvents(events: TimelineEvent[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('events', 'readwrite');
    await Promise.all(events.map(event => tx.store.put(event)));
    await tx.done;
}

export async function deleteEvent(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('events', id);
}

// ============================================
// Document Operations
// ============================================

export async function getDocumentsByTrip(tripId: string): Promise<Document[]> {
    const db = await getDB();
    return db.getAllFromIndex('documents', 'by-trip', tripId);
}

export async function getDocument(id: string): Promise<Document | undefined> {
    const db = await getDB();
    return db.get('documents', id);
}

export async function saveDocument(doc: Document): Promise<void> {
    const db = await getDB();
    await db.put('documents', doc);
}

export async function deleteDocument(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('documents', id);
}

// ============================================
// Sync Queue Operations
// ============================================

export async function addToSyncQueue(action: Omit<SyncAction, 'id'>): Promise<void> {
    const db = await getDB();
    await db.add('syncQueue', action as SyncAction);
}

export async function getPendingSyncActions(): Promise<SyncAction[]> {
    const db = await getDB();
    return db.getAllFromIndex('syncQueue', 'by-synced', 0);
}

export async function markSyncActionComplete(id: number): Promise<void> {
    const db = await getDB();
    const action = await db.get('syncQueue', id);
    if (action) {
        action.synced = true;
        await db.put('syncQueue', action);
    }
}

export async function clearSyncedActions(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const index = tx.store.index('by-synced');
    let cursor = await index.openCursor(1);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

// ============================================
// Meta Operations
// ============================================

export async function getMeta(key: string): Promise<any> {
    const db = await getDB();
    const result = await db.get('meta', key);
    return result?.value;
}

export async function setMeta(key: string, value: any): Promise<void> {
    const db = await getDB();
    await db.put('meta', { key, value });
}

// ============================================
// Utility Functions
// ============================================

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}
