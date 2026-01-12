import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { TimelineEvent } from '../components/TimelineItem';
import { db, DbTrip, DbEvent, subscribeToTrips, subscribeToEvents, checkSupabaseConnection } from '../lib/supabase';
import { storage, initializeDefaultData, TimelineEvent as StoredEvent } from '../lib/storage';

// Default trip ID for shared access
const DEFAULT_TRIP_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

interface TripContextType {
    // Loading state
    isLoading: boolean;
    isOnline: boolean;

    // Trip Settings
    tripName: string;
    setTripName: (name: string) => void;
    startDate: Date;
    setStartDate: (date: Date) => void;
    tripDuration: number;
    setTripDuration: (days: number) => void;
    placesCoverImage: string;
    setPlacesCoverImage: (url: string) => void;

    // Events
    events: TimelineEvent[];
    setEvents: (events: TimelineEvent[] | ((prev: TimelineEvent[]) => TimelineEvent[])) => void;
    deleteEvent: (id: string) => Promise<void>;

    // Computed
    tripDates: { dateObj: Date; dayName: string; dateNum: number; fullDate: string; offset: number }[];

    // Current trip
    currentTripId: string | null;

    // Refresh data
    refreshData: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

// Convert DB event to Timeline event
function dbEventToTimelineEvent(e: DbEvent): TimelineEvent {
    // console.log(`[TripContext] Mapping DB Event: ${e.title}, is_start: ${e.is_start}, is_end: ${e.is_end}`);
    return {
        id: e.id,
        type: e.type,
        title: e.title,
        time: e.time,
        endTime: e.end_time || undefined,
        description: e.description || undefined,
        rating: e.rating || undefined,
        reviews: e.reviews || undefined,
        image: e.image || undefined,
        status: e.status || undefined,
        duration: e.duration || undefined,
        googleMapsLink: e.google_maps_link || undefined,
        travelTime: e.travel_time || undefined,
        travelMode: e.travel_mode || undefined,
        dayOffset: e.day_offset,
        congestion: (e.congestion as 'low' | 'moderate' | 'high') || undefined,
        // Google Places data
        openingHours: e.opening_hours || undefined,
        // Location data for Routes API
        placeId: e.place_id || undefined,
        lat: e.lat || undefined,
        lng: e.lng || undefined,
        address: e.address || undefined,
        isStart: e.is_start || false,
        isEnd: e.is_end || false,
    };
}

// Convert Timeline event to DB event format
function timelineEventToDbEvent(e: TimelineEvent, tripId: string, sortOrder: number): Omit<DbEvent, 'created_at' | 'updated_at'> {
    return {
        id: e.id,
        trip_id: tripId,
        type: e.type,
        title: e.title,
        time: e.time,
        end_time: e.endTime || null,
        description: e.description || null,
        rating: e.rating || null,
        reviews: e.reviews || null,
        image: e.image || null,
        status: e.status || null,
        duration: e.duration || null,
        google_maps_link: e.googleMapsLink || null,
        travel_time: e.travelTime || null,
        travel_mode: e.travelMode || null,
        day_offset: e.dayOffset ?? 0,
        sort_order: sortOrder,
        congestion: e.congestion || null,
        // Location data for Routes API
        place_id: e.placeId || null,
        lat: e.lat || null,
        lng: e.lng || null,
        address: e.address || null,
        opening_hours: e.openingHours || null,
        is_start: e.isStart || null,
        is_end: e.isEnd || null,
    };
}

export function TripProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [currentTripId, setCurrentTripId] = useState<string | null>(null);
    const [tripName, setTripNameState] = useState('');
    const [startDate, setStartDateState] = useState(new Date());
    const [tripDuration, setTripDurationState] = useState(9);
    const [placesCoverImage, setPlacesCoverImageState] = useState('');
    const [events, setEventsState] = useState<TimelineEvent[]>([]);
    // Ref to hold the authoritative latest state for rapid updates
    const eventsRef = React.useRef<TimelineEvent[]>([]);

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Load data from Supabase or fallback to IndexedDB
    const loadData = useCallback(async () => {
        try {
            // Check Supabase connection
            const supabaseConnected = await checkSupabaseConnection();
            setIsOnline(supabaseConnected);

            if (supabaseConnected) {
                // Load from Supabase (cloud)
                console.log('[TripContext] Loading from Supabase...');

                const tripId = DEFAULT_TRIP_ID;
                setCurrentTripId(tripId);

                const trip = await db.getTrip(tripId);
                if (trip) {
                    setTripNameState(trip.name);
                    setStartDateState(new Date(trip.start_date));
                    setTripDurationState(trip.duration);
                    setPlacesCoverImageState(trip.cover_image || '');
                } else {
                    console.log('[TripContext] Default trip not found, creating...');
                    const newTrip = await db.createTrip({
                        id: tripId,
                        name: 'My Trip to Bali',
                        start_date: new Date().toISOString().split('T')[0],
                        duration: 9,
                        cover_image: null
                    } as any);

                    if (newTrip) {
                        setTripNameState(newTrip.name);
                        setStartDateState(new Date(newTrip.start_date));
                        setTripDurationState(newTrip.duration);
                    }
                }

                const dbEvents = await db.getEvents(tripId);
                setEventsState(dbEvents.map(dbEventToTimelineEvent));

                console.log('[TripContext] Loaded from Supabase:', trip?.name, 'Events:', dbEvents.length);
            } else {
                // Fallback to IndexedDB (offline)
                console.log('[TripContext] Supabase unavailable, using IndexedDB...');
                await initializeDefaultData();

                const tripId = await storage.getCurrentTripId();
                if (tripId) {
                    setCurrentTripId(tripId);

                    const trip = await storage.getTrip(tripId);
                    if (trip) {
                        setTripNameState(trip.name);
                        setStartDateState(new Date(trip.startDate));
                        setTripDurationState(trip.duration);
                        setPlacesCoverImageState(trip.coverImage);
                    }

                    const storedEvents = await storage.getEvents(tripId);
                    setEventsState(storedEvents.map(e => ({
                        // ... (existing mapping) ...
                        ...e,
                        connection: (e.congestion as 'low' | 'moderate' | 'high') || undefined,
                    } as any)));
                }
            }
        } catch (error) {
            console.error('[TripContext] Load error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Sync Ref with State whenever state changes (e.g. from real-time updates)
    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    // Initialize on mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Subscribe to real-time updates from Supabase
    useEffect(() => {
        if (!isOnline || !currentTripId) return;

        console.log('[TripContext] Setting up real-time subscriptions...');

        const tripChannel = subscribeToTrips((payload) => {
            if (payload.eventType === 'UPDATE' && payload.new) {
                const trip = payload.new as DbTrip;
                if (trip.id === currentTripId) {
                    setTripNameState(trip.name);
                    setStartDateState(new Date(trip.start_date));
                    setTripDurationState(trip.duration);
                    setPlacesCoverImageState(trip.cover_image || '');
                }
            }
        });

        const eventChannel = subscribeToEvents(currentTripId, (payload) => {
            console.log('[TripContext] Real-time event update:', payload.eventType);
            db.getEvents(currentTripId).then(dbEvents => {
                setEventsState(dbEvents.map(dbEventToTimelineEvent));
            });
        });

        return () => {
            tripChannel.unsubscribe();
            eventChannel.unsubscribe();
        };
    }, [isOnline, currentTripId]);

    const setTripName = async (name: string) => {
        setTripNameState(name);
        if (currentTripId) {
            if (isOnline) await db.updateTrip(currentTripId, { name });
            else await storage.updateTrip(currentTripId, { name });
        }
    };

    const setStartDate = async (date: Date) => {
        setStartDateState(date);
        if (currentTripId) {
            const dateStr = date.toISOString().split('T')[0];
            if (isOnline) await db.updateTrip(currentTripId, { start_date: dateStr });
            else await storage.updateTrip(currentTripId, { startDate: dateStr });
        }
    };

    const setTripDuration = async (days: number) => {
        setTripDurationState(days);
        if (currentTripId) {
            if (isOnline) await db.updateTrip(currentTripId, { duration: days });
            else await storage.updateTrip(currentTripId, { duration: days });
        }
    };

    const setPlacesCoverImage = async (url: string) => {
        setPlacesCoverImageState(url);
        if (currentTripId) {
            if (isOnline) await db.updateTrip(currentTripId, { cover_image: url });
            else await storage.updateTrip(currentTripId, { coverImage: url });
        }
    };

    const setEvents = async (eventsOrUpdater: TimelineEvent[] | ((prev: TimelineEvent[]) => TimelineEvent[])) => {
        // Use Ref to get the absolutely latest state, bypassing render cycles for rapid updates
        const currentEvents = eventsRef.current;
        let newEvents: TimelineEvent[];

        if (typeof eventsOrUpdater === 'function') {
            newEvents = eventsOrUpdater(currentEvents);
        } else {
            newEvents = eventsOrUpdater;
        }

        // Update Ref IMMEDIATELY so next call sees it
        eventsRef.current = newEvents;

        // Trigger React Update for UI
        setEventsState(newEvents);

        if (currentTripId) {
            try {
                if (isOnline) {
                    // Convert to DB format and upsert
                    const dbEvents = newEvents.map((e, i) =>
                        timelineEventToDbEvent(e, currentTripId, i)
                    ) as DbEvent[];
                    // console.log('DEBUG: Upserting events count:', dbEvents.length);
                    await db.upsertEvents(dbEvents);
                } else {
                    // Fallback to IndexedDB
                    const storedEvents: StoredEvent[] = newEvents.map(e => ({
                        ...e,
                        tripId: currentTripId!,
                        dayOffset: e.dayOffset ?? 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }));
                    await storage.updateEvents(currentTripId, storedEvents);
                }
            } catch (error: any) {
                console.error('[TripContext] Failed to persist events. Details:', JSON.stringify(error, null, 2));
                // Optionally revert state here if critical, but for now just log
                // Consider adding a toast notification here
                alert(`Failed to save changes. Server says: ${error.message || 'Unknown error'}`);
            }
        }
    };

    const deleteEvent = async (id: string) => {
        // Optimistic update using Ref
        const previousEvents = eventsRef.current;
        const newEvents = previousEvents.filter(e => e.id !== id);

        eventsRef.current = newEvents;
        setEventsState(newEvents);

        if (currentTripId) {
            try {
                if (isOnline) {
                    await db.deleteEvent(id);
                } else {
                    await storage.deleteEvent(id);
                }
            } catch (error) {
                console.error('[TripContext] Failed to delete event:', error);
                // Revert on error
                eventsRef.current = previousEvents;
                setEventsState(previousEvents);
            }
        }
    };

    const tripDates = useMemo(() => {
        return Array.from({ length: tripDuration }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            return {
                dateObj: d,
                dayName: DAYS[d.getDay()],
                dateNum: d.getDate(),
                fullDate: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`,
                offset: i
            };
        });
    }, [startDate, tripDuration]);

    return (
        <TripContext.Provider value={{
            isLoading,
            isOnline,
            tripName, setTripName,
            startDate, setStartDate,
            tripDuration, setTripDuration,
            placesCoverImage, setPlacesCoverImage,
            events, setEvents, deleteEvent,
            tripDates,
            currentTripId,
            refreshData: loadData,
        }}>
            {children}
        </TripContext.Provider>
    );
}

export function useTrip() {
    const context = useContext(TripContext);
    if (context === undefined) {
        throw new Error('useTrip must be used within a TripProvider');
    }
    return context;
}


