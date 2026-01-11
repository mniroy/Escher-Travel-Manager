// High-level storage abstraction with offline detection and sync queue management
import {
    Trip,
    TimelineEvent,
    Document,
    getTrip,
    getAllTrips,
    saveTrip,
    deleteTrip as dbDeleteTrip,
    getEventsByTrip,
    saveEvent,
    saveEvents,
    deleteEvent as dbDeleteEvent,
    getDocumentsByTrip,
    saveDocument,
    deleteDocument as dbDeleteDocument,
    addToSyncQueue,
    generateId,
    getCurrentTimestamp,
    getMeta,
    setMeta,
} from './db';

// ============================================
// Online Status Detection
// ============================================

export function isOnline(): boolean {
    return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}

// ============================================
// Storage Service
// ============================================

export const storage = {
    // ---- Trip Operations ----

    async getTrips(): Promise<Trip[]> {
        return getAllTrips();
    },

    async getTrip(id: string): Promise<Trip | undefined> {
        return getTrip(id);
    },

    async createTrip(data: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
        const trip: Trip = {
            ...data,
            id: generateId(),
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
        };

        await saveTrip(trip);

        // Queue for sync
        await addToSyncQueue({
            type: 'create',
            entity: 'trip',
            entityId: trip.id,
            data: trip,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });

        return trip;
    },

    async updateTrip(id: string, data: Partial<Trip>): Promise<Trip | undefined> {
        const existing = await getTrip(id);
        if (!existing) return undefined;

        const updated: Trip = {
            ...existing,
            ...data,
            id, // Ensure ID doesn't change
            updatedAt: getCurrentTimestamp(),
        };

        await saveTrip(updated);

        await addToSyncQueue({
            type: 'update',
            entity: 'trip',
            entityId: id,
            data: updated,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });

        return updated;
    },

    async deleteTrip(id: string): Promise<void> {
        await dbDeleteTrip(id);

        await addToSyncQueue({
            type: 'delete',
            entity: 'trip',
            entityId: id,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });
    },

    // ---- Event Operations ----

    async getEvents(tripId: string): Promise<TimelineEvent[]> {
        return getEventsByTrip(tripId);
    },

    async createEvent(data: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimelineEvent> {
        const event: TimelineEvent = {
            ...data,
            id: generateId(),
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
        };

        await saveEvent(event);

        await addToSyncQueue({
            type: 'create',
            entity: 'event',
            entityId: event.id,
            data: event,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });

        return event;
    },

    async updateEvent(id: string, tripId: string, data: Partial<TimelineEvent>): Promise<TimelineEvent | undefined> {
        const events = await getEventsByTrip(tripId);
        const existing = events.find(e => e.id === id);
        if (!existing) return undefined;

        const updated: TimelineEvent = {
            ...existing,
            ...data,
            id,
            tripId,
            updatedAt: getCurrentTimestamp(),
        };

        await saveEvent(updated);

        await addToSyncQueue({
            type: 'update',
            entity: 'event',
            entityId: id,
            data: updated,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });

        return updated;
    },

    async updateEvents(tripId: string, events: TimelineEvent[]): Promise<void> {
        const updatedEvents = events.map(e => ({
            ...e,
            tripId,
            updatedAt: getCurrentTimestamp(),
        }));

        await saveEvents(updatedEvents);

        // Add batch update to sync queue
        await addToSyncQueue({
            type: 'update',
            entity: 'event',
            entityId: `batch-${tripId}`,
            data: updatedEvents,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });
    },

    async deleteEvent(id: string): Promise<void> {
        await dbDeleteEvent(id);

        await addToSyncQueue({
            type: 'delete',
            entity: 'event',
            entityId: id,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });
    },

    // ---- Document Operations ----

    async getDocuments(tripId: string): Promise<Document[]> {
        return getDocumentsByTrip(tripId);
    },

    async createDocument(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
        const doc: Document = {
            ...data,
            id: generateId(),
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
        };

        await saveDocument(doc);

        await addToSyncQueue({
            type: 'create',
            entity: 'document',
            entityId: doc.id,
            data: doc,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });

        return doc;
    },

    async deleteDocument(id: string): Promise<void> {
        await dbDeleteDocument(id);

        await addToSyncQueue({
            type: 'delete',
            entity: 'document',
            entityId: id,
            timestamp: getCurrentTimestamp(),
            synced: false,
        });
    },

    // ---- Meta Operations ----

    async getCurrentTripId(): Promise<string | null> {
        return getMeta('currentTripId') || null;
    },

    async setCurrentTripId(tripId: string): Promise<void> {
        await setMeta('currentTripId', tripId);
    },

    async getLastSyncTime(): Promise<string | null> {
        return getMeta('lastSyncTime') || null;
    },

    async setLastSyncTime(time: string): Promise<void> {
        await setMeta('lastSyncTime', time);
    },
};

// ============================================
// Initial Data Migration
// ============================================

// Default trip data to initialize the app
const DEFAULT_TRIP: Trip = {
    id: 'default-trip',
    name: 'Bali Trip',
    startDate: '2024-08-21',
    duration: 9,
    coverImage: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const DEFAULT_EVENTS: Omit<TimelineEvent, 'createdAt' | 'updatedAt'>[] = [
    {
        id: '1',
        tripId: 'default-trip',
        type: 'Transport',
        title: 'Arrive at Zurich International Airport',
        time: '03:00 PM',
        description: 'Terminal 1, Flight LX180',
        dayOffset: 0,
        duration: '45m'
    },
    {
        id: '2',
        tripId: 'default-trip',
        type: 'Eat',
        title: 'Elfrentes Roasting',
        time: '04:00 PM',
        endTime: '11:00 PM',
        status: 'Open now',
        rating: 4.7,
        reviews: 2735,
        description: 'Specialty coffee roaster with light bites.',
        dayOffset: 0,
        travelTime: '30m',
        travelMode: 'drive',
        duration: '1h 30m'
    },
    {
        id: '3',
        tripId: 'default-trip',
        type: 'Play',
        title: 'Spend the day exploring Zurich',
        time: '05:00 PM',
        description: 'Old Town, Lake Zurich, and Bahnhofstrasse.',
        dayOffset: 0,
        travelTime: '15m',
        travelMode: 'walk',
        duration: '3h'
    },
    {
        id: '4',
        tripId: 'default-trip',
        type: 'Eat',
        title: 'Elmira fine dining',
        time: '07:00 PM',
        rating: 4.9,
        reviews: 854,
        description: 'Modern Swiss cuisine.',
        dayOffset: 0,
        travelTime: '20m',
        travelMode: 'transit',
        duration: '2h'
    },
    {
        id: '5',
        tripId: 'default-trip',
        type: 'Stay',
        title: 'BVLGARI Hotel',
        time: '07:45 PM',
        description: 'Check-in confirmed.',
        dayOffset: 0,
        travelTime: '10m',
        travelMode: 'drive'
    },
    {
        id: '6',
        tripId: 'default-trip',
        type: 'Eat',
        title: 'Cafe Odeon',
        time: '09:00 AM',
        description: 'Historic Art Nouveau café.',
        dayOffset: 1,
        duration: '1h'
    },
    {
        id: '7',
        tripId: 'default-trip',
        type: 'Play',
        title: 'Kunsthaus Zürich',
        time: '11:00 AM',
        description: 'Visit the art museum.',
        dayOffset: 1,
        duration: '2h 15m'
    }
];

export async function initializeDefaultData(): Promise<void> {
    const trips = await getAllTrips();

    if (trips.length === 0) {
        // No trips exist, initialize with default data
        await saveTrip(DEFAULT_TRIP);

        const timestamp = getCurrentTimestamp();
        const events = DEFAULT_EVENTS.map(e => ({
            ...e,
            createdAt: timestamp,
            updatedAt: timestamp,
        }));

        await saveEvents(events);
        await setMeta('currentTripId', DEFAULT_TRIP.id);

        console.log('[Storage] Initialized with default trip data');
    }
}

export type { Trip, TimelineEvent, Document };
