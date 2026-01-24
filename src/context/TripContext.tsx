import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { TimelineEvent } from '../components/TimelineItem';
import { db, DbTrip, DbEvent, DbHistory, subscribeToTrips, subscribeToEvents, checkSupabaseConnection } from '../lib/supabase';
import { storage, initializeDefaultData, TimelineEvent as StoredEvent } from '../lib/storage';
import { uuidv4 } from '../lib/uuid';

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
    updateTripDetails: (updates: { name?: string; startDate?: Date; duration?: number; coverImage?: string }) => Promise<void>;

    // Events
    events: TimelineEvent[];
    setEvents: (events: TimelineEvent[] | ((prev: TimelineEvent[]) => TimelineEvent[])) => void;
    deleteEvent: (id: string) => Promise<void>;

    // Computed
    tripDates: { dateObj: Date; dayName: string; dateNum: number; fullDate: string; offset: number }[];

    // Current trip
    currentTripId: string | null;

    // Trip Management
    trips: DbTrip[];
    createNewTrip: () => Promise<void>;
    switchTrip: (id: string) => Promise<void>;

    // Current State
    selectedDayOffset: number;
    setSelectedDayOffset: (offset: number) => void;

    // History
    history: DbHistory[];
    addHistoryRecord: (actionType: 'delete' | 'add' | 'update', event: TimelineEvent, comment?: string) => Promise<void>;
    updateHistoryComment: (id: string, comment: string) => Promise<void>;

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
        travelDistance: e.travel_distance || undefined,
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
        parkingBuffer: e.parking_buffer ?? undefined,
        isStart: e.is_start || false,
        isEnd: e.is_end || false,
    };
}

// Convert Timeline event to DB event format
function timelineEventToDbEvent(e: TimelineEvent, tripId: string, sortOrder: number): Omit<DbEvent, 'created_at' | 'updated_at'> {
    const dbEvent = {
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
        travel_distance: e.travelDistance || null,
        travel_mode: e.travelMode || null,
        day_offset: e.dayOffset ?? 0,
        sort_order: sortOrder,
        congestion: e.congestion || null,
        // Location data for Routes API
        place_id: e.placeId || null,
        lat: e.lat || null,
        lng: e.lng || null,
        address: e.address || null,
        parking_buffer: e.parkingBuffer ?? null,
        opening_hours: e.openingHours || null,
        is_start: e.isStart || null,
        is_end: e.isEnd || null,
    };
    // console.log(`[TripContext] Converting to DB: ${e.title}, Parking: ${e.parkingBuffer} -> ${dbEvent.parking_buffer}`);
    return dbEvent;
}

export function TripProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [currentTripId, setCurrentTripId] = useState<string | null>(null);
    const [trips, setTrips] = useState<DbTrip[]>([]); // List of all trips

    const [tripName, setTripNameState] = useState('');
    const [startDate, setStartDateState] = useState(new Date());
    const [tripDuration, setTripDurationState] = useState(9);
    const [placesCoverImage, setPlacesCoverImageState] = useState('');
    const [events, setEventsState] = useState<TimelineEvent[]>([]);
    const [history, setHistory] = useState<DbHistory[]>([]);
    // Ref to hold the authoritative latest state for rapid updates
    const eventsRef = React.useRef<TimelineEvent[]>([]);
    // Ref to ignore realtime updates for a bit after we push changes
    const lastLocalUpdateRef = React.useRef<number>(0);

    // Persisted UI State
    const [selectedDayOffset, setSelectedDayOffsetState] = useState<number>(() => {
        const saved = localStorage.getItem('selectedDayOffset');
        return saved !== null ? parseInt(saved, 10) : 0;
    });

    const setSelectedDayOffset = (offset: number) => {
        setSelectedDayOffsetState(offset);
        localStorage.setItem('selectedDayOffset', offset.toString());
    };

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Helper to load a specific trip's details into state
    const loadTripDetails = async (tripId: string, tripData?: DbTrip) => {
        try {
            let trip = tripData;
            if (!trip) {
                if (isOnline) {
                    const data = await db.getTrip(tripId);
                    trip = data || undefined;
                } else {
                    trip = await storage.getTrip(tripId) as any;
                }
            }

            if (trip) {
                setTripNameState(trip.name);
                setStartDateState(new Date(trip.start_date));
                setTripDurationState(trip.duration);
                setPlacesCoverImageState(trip.cover_image || '');
                setCurrentTripId(trip.id);

                // Load events for this trip
                let dbEvents: DbEvent[] = [];
                if (isOnline) {
                    dbEvents = await db.getEvents(tripId);
                } else {
                    const storedEvents = await storage.getEvents(tripId);
                    // Map stored events types to match DbEvent if needed, strictly speaking they are similar
                    // We'll reuse the logic from loadData
                    dbEvents = storedEvents as unknown as DbEvent[];
                }

                setEventsState(dbEvents.map(dbEventToTimelineEvent));

                // Load history
                if (isOnline) {
                    const histData = await db.getHistory(tripId);
                    setHistory(histData);
                }

                console.log(`[TripContext] Loaded trip: ${trip.name} (${trip.id})`);
            }
        } catch (e) {
            console.error('[TripContext] Failed to load trip details', e);
        }
    };

    // Load data from Supabase or fallback to IndexedDB
    const loadData = useCallback(async () => {
        try {
            // Check Supabase connection
            const supabaseConnected = await checkSupabaseConnection();
            setIsOnline(supabaseConnected);

            let allTrips: DbTrip[] = [];

            if (supabaseConnected) {
                // Load ALL trips from Supabase
                console.log('[TripContext] Loading ALL trips from Supabase...');
                allTrips = await db.getTrips();
                setTrips(allTrips);
            } else {
                // Fallback to IndexedDB (offline)
                console.log('[TripContext] Supabase unavailable, using IndexedDB...');
                await initializeDefaultData();
                // We need a helper to get all trips from IDB, but storage currently only has getTrip(id).
                // For now, let's assume valid IDB usage mirrors what we need or we rely on the single current stored ID.
                // TODO: Implement storage.getAllTrips() if full offline multi-trip is needed.
                // For this MVP step, we'll try to load the current persisted ID.
                const storedTripId = await storage.getCurrentTripId();
                if (storedTripId) {
                    // Fake the list with one trip if offline for now
                    const t = await storage.getTrip(storedTripId);
                    if (t) allTrips = [t as any];
                }
            }

            // Determine which trip to load
            let targetTripId = currentTripId; // Keep current if valid

            // If no current trip selected, try to load from storage or pick first available
            if (!targetTripId) {
                const storedTripId = await storage.getCurrentTripId();
                if (storedTripId && allTrips.find(t => t.id === storedTripId)) {
                    targetTripId = storedTripId;
                } else if (allTrips.length > 0) {
                    targetTripId = allTrips[0].id;
                } else {
                    // No trips at all! Create a default one.
                    const defaultId = DEFAULT_TRIP_ID;
                    console.log('[TripContext] No trips found, creating default...');
                    if (supabaseConnected) {
                        const newTrip = await db.createTrip({
                            id: defaultId,
                            name: 'My Trip to Bali',
                            start_date: new Date().toISOString().split('T')[0],
                            duration: 9,
                            cover_image: null
                        } as any);
                        allTrips = [newTrip];
                        setTrips(allTrips);
                        targetTripId = newTrip.id;
                    }
                }
            }

            // Finally load the details for the target trip
            if (targetTripId) {
                await loadTripDetails(targetTripId);
            }

        } catch (error) {
            console.error('[TripContext] Load error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentTripId]); // Depend on currentTripId so we don't random switch on re-renders, but effectively we manage it manually

    const createNewTrip = async () => {
        const newId = uuidv4();
        const today = new Date().toISOString().split('T')[0];

        try {
            const newTripData = {
                id: newId,
                name: 'New Trip',
                start_date: today,
                duration: 5,
                cover_image: null
            } as any;

            if (isOnline) {
                const created = await db.createTrip(newTripData);
                setTrips(prev => [created, ...prev]);
                await switchTrip(created.id);
            } else {
                // Offline creation
                alert("Offline trip creation not fully supported in this demo yet.");
            }
        } catch (e) {
            console.error("Failed to create trip", e);
        }
    };

    const switchTrip = async (id: string) => {
        setIsLoading(true);
        // Find basic data in our list to optimize immediate feedback
        const tripSummary = trips.find(t => t.id === id);
        if (tripSummary) {
            // Optimistic switch
            setTripNameState(tripSummary.name);
            setCurrentTripId(id);
            await storage.setCurrentTripId(id); // Persist selection
            // Then load full details (events etc)
            await loadTripDetails(id, tripSummary);
        } else {
            await storage.setCurrentTripId(id); // Persist selection
            await loadTripDetails(id);
        }
        setIsLoading(false);
    };

    // Sync Ref with State whenever state changes (e.g. from real-time updates)
    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    // Initialize on mount
    useEffect(() => {
        loadData();
    }, []); // Run once on mount

    // Subscribe to real-time updates from Supabase
    useEffect(() => {
        if (!isOnline) return;

        console.log('[TripContext] Setting up global real-time subscriptions...');

        // Subscribe to trip list changes (add/delete trips)
        const tripChannel = subscribeToTrips((payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
                setTrips(prev => [payload.new as DbTrip, ...prev]);
            } else if (payload.eventType === 'DELETE' && payload.old) {
                setTrips(prev => prev.filter(t => t.id !== (payload.old as DbTrip).id));
            } else if (payload.eventType === 'UPDATE' && payload.new) {
                // Update list and current if matches
                const updated = payload.new as DbTrip;
                setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
                if (currentTripId === updated.id) {
                    setTripNameState(updated.name);
                    setStartDateState(new Date(updated.start_date));
                    setTripDurationState(updated.duration);
                    setPlacesCoverImageState(updated.cover_image || '');
                }
            }
        });

        // Event subscription is specific to the current trip
        let eventChannel: any;
        if (currentTripId) {
            eventChannel = subscribeToEvents(currentTripId, (payload) => {
                // If we recently pushed a local update, ignore the incoming stream for a second
                // to avoid the "revert" flicker caused by re-fetching while the DB is still processing.
                const timeSinceLastLocalUpdate = Date.now() - lastLocalUpdateRef.current;
                if (timeSinceLastLocalUpdate < 2000) {
                    console.log('[TripContext] Ignoring real-time update (too soon after local change)');
                    return;
                }

                console.log('[TripContext] Real-time event update:', payload.eventType);
                db.getEvents(currentTripId).then(dbEvents => {
                    setEventsState(dbEvents.map(dbEventToTimelineEvent));
                });
            });
        }

        return () => {
            tripChannel.unsubscribe();
            if (eventChannel) eventChannel.unsubscribe();
        };
    }, [isOnline, currentTripId]); // Re-sub when current trip changes

    const fetchTripImage = async (tripId: string, query: string) => {
        if (!query || query.length < 3 || query === 'New Trip') return;

        try {
            console.log(`[TripContext] Auto-fetching image for: ${query}`);
            const response = await fetch('/api/parse-place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: `https://www.google.com/maps/search/${encodeURIComponent(query)}` })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.photos && data.photos.length > 0) {
                    const photoUrl = data.photos[0];
                    console.log(`[TripContext] Found image for ${query}:`, photoUrl.substring(0, 50) + '...');

                    if (tripId === currentTripId) {
                        setPlacesCoverImageState(photoUrl);
                    }

                    // Always update DB/Storage for persistence
                    if (isOnline) {
                        await db.updateTrip(tripId, { cover_image: photoUrl });
                    } else {
                        await storage.updateTrip(tripId, { coverImage: photoUrl });
                    }

                    // Update local trips list to reflect the new image immediately in Sidebar
                    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, cover_image: photoUrl } : t));
                }
            }
        } catch (error) {
            console.error('[TripContext] Failed to fetch trip image:', error);
        }
    };

    const updateTripDetails = async (updates: { name?: string; startDate?: Date; duration?: number; coverImage?: string }) => {
        if (!currentTripId) return;

        const dbUpdates: any = {};

        if (updates.name !== undefined) {
            setTripNameState(updates.name);
            setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, name: updates.name! } : t));
            dbUpdates.name = updates.name;
        }

        if (updates.startDate !== undefined) {
            setStartDateState(updates.startDate);
            const dateStr = updates.startDate.toISOString().split('T')[0];
            setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, start_date: dateStr } : t));
            dbUpdates.start_date = dateStr;
        }

        if (updates.duration !== undefined) {
            setTripDurationState(updates.duration);
            setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, duration: updates.duration! } : t));
            dbUpdates.duration = updates.duration;
        }

        if (updates.coverImage !== undefined) {
            setPlacesCoverImageState(updates.coverImage);
            setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, cover_image: updates.coverImage! } : t));
            dbUpdates.cover_image = updates.coverImage;
        }

        if (Object.keys(dbUpdates).length > 0) {
            if (isOnline) {
                await db.updateTrip(currentTripId, dbUpdates);
            } else {
                // Map db keys back to storage keys if necessary or just pass object if compatible
                const storageUpdates = {
                    name: dbUpdates.name,
                    startDate: dbUpdates.start_date,
                    duration: dbUpdates.duration,
                    coverImage: dbUpdates.cover_image
                };
                // Remove undefined
                Object.keys(storageUpdates).forEach(key => (storageUpdates as any)[key] === undefined && delete (storageUpdates as any)[key]);
                await storage.updateTrip(currentTripId, storageUpdates);
            }
        }

        // Fetch image check if name changed
        if (updates.name) {
            fetchTripImage(currentTripId, updates.name);
        }
    };

    const setTripName = async (name: string) => updateTripDetails({ name });
    const setStartDate = async (date: Date) => updateTripDetails({ startDate: date });
    const setTripDuration = async (days: number) => updateTripDetails({ duration: days });
    const setPlacesCoverImage = async (url: string) => updateTripDetails({ coverImage: url });

    // ... keep setEvents, deleteEvent ...
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
                // Mark time of local update to ignore incoming echo
                lastLocalUpdateRef.current = Date.now();

                if (isOnline) {
                    // Convert to DB format and upsert
                    const dbEvents = newEvents.map((e, i) =>
                        timelineEventToDbEvent(e, currentTripId, i)
                    ) as DbEvent[];
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
                // Record deletion in history BEFORE actual deletion if possible, 
                // or just snapshot it now.
                const eventToSnapshot = previousEvents.find(e => e.id === id);
                if (eventToSnapshot) {
                    await addHistoryRecord('delete', eventToSnapshot, 'Item deleted from itinerary');
                }

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

    const addHistoryRecord = async (actionType: 'delete' | 'add' | 'update', event: TimelineEvent, comment?: string) => {
        if (!currentTripId) return;

        const record: Omit<DbHistory, 'id' | 'created_at'> = {
            trip_id: currentTripId,
            action_type: actionType,
            event_title: event.title,
            event_data: event,
            comment: comment || null
        };

        if (isOnline) {
            try {
                const newRecord = await db.createHistoryRecord(record);
                setHistory(prev => [newRecord, ...prev]);
            } catch (error) {
                console.error('[TripContext] Failed to create history record:', error);
            }
        } else {
            // Local fallback could be implemented if needed
            console.warn('[TripContext] Offline history recording not implemented');
        }
    };

    const updateHistoryComment = async (id: string, comment: string) => {
        if (isOnline) {
            try {
                const updated = await db.updateHistoryComment(id, comment);
                setHistory(prev => prev.map(h => h.id === id ? updated : h));
            } catch (error) {
                console.error('[TripContext] Failed to update history comment:', error);
            }
        }
    };

    const tripDates = useMemo(() => {
        return Array.from({ length: tripDuration }, (_, i) => {
            const d = new Date(startDate);
            d.setUTCDate(d.getUTCDate() + i);
            return {
                dateObj: d,
                dayName: DAYS[d.getUTCDay()],
                dateNum: d.getUTCDate(),
                fullDate: `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
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
            trips, // New
            createNewTrip, // New
            switchTrip, // New
            refreshData: loadData,
            updateTripDetails, // New
            selectedDayOffset,
            setSelectedDayOffset,
            history,
            addHistoryRecord,
            updateHistoryComment,
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


