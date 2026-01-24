import { db } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { uuidv4 } from '../lib/uuid';
import { Category, CategoryFilter } from '../components/CategoryFilter';
import { TimelineItem, TimelineEvent } from '../components/TimelineItem';
import { AddActivityModal, NewActivity } from '../components/AddActivityModal';
import { Plus, Plane, Coffee, MapPin, Bed, Pencil, Check, X, Sparkles, ChevronUp, ChevronDown, RefreshCcw, Clock, CarFront, Hourglass, GripVertical, Calendar, CalendarDays } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { motion, AnimatePresence, useScroll, useTransform, Reorder, useDragControls } from 'framer-motion';
import { optimizeRoute } from '../lib/googleMaps';
import { PlaceSelectorModal } from '../components/PlaceSelectorModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper functions for time calculation
// ... existing parseTime/parseDuration ...

const calculateScheduleForList = (sourceEvents: TimelineEvent[], selectedOffsets: number[]) => {
    const currentOffsets = new Set(selectedOffsets);
    const dayEvents = sourceEvents.filter(e => currentOffsets.has(e.dayOffset || 0));
    const otherEvents = sourceEvents.filter(e => !currentOffsets.has(e.dayOffset || 0));

    if (dayEvents.length === 0) return sourceEvents;

    // Use the first event's time as the anchor for the whole day
    let currentTime = parseTime(dayEvents[0].time);

    const updatedDayEvents = dayEvents.map((event, index) => {
        const parkingBuffer = event.parkingBuffer ?? 10;

        if (index > 0 && event.travelTime) {
            const travelMins = parseDuration(event.travelTime);
            // Add travel time + parking buffer to get to the location
            currentTime += (travelMins + parkingBuffer);
        }

        const newTimeStr = formatTime(currentTime);

        // Start items and End items have no "stay" duration in the timeline logic
        const isAnchor = index === 0 || index === dayEvents.length - 1 || event.isStart || event.isEnd;
        const duration = isAnchor ? 0 : parseDuration(event.duration);

        currentTime += duration;

        return { ...event, time: newTimeStr };
    });

    return [...otherEvents, ...updatedDayEvents];
};

const parseTime = (str: string) => {
    try {
        if (!str || typeof str !== 'string' || str.startsWith('NaN')) return 9 * 60;

        // More robust parsing: handle "11:40 AM" or "11:40AM" or "11:40"
        const timeMatch = str.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
        if (!timeMatch) return 9 * 60;

        let h = parseInt(timeMatch[1]);
        const m = parseInt(timeMatch[2]);
        const period = timeMatch[3]?.toUpperCase();

        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;

        return h * 60 + m;
    } catch (e) {
        return 9 * 60; // Default 9 AM
    }
};

const parseDuration = (str?: string) => {
    if (!str || typeof str !== 'string') return 0; // Default 0 for undefined/null
    try {
        const hMatch = str.match(/(\d+)\s*h/i);
        const mMatch = str.match(/(\d+)\s*m/i);
        let m = 0;
        if (hMatch) m += parseInt(hMatch[1]) * 60;
        if (mMatch) m += parseInt(mMatch[1]);
        return m;
    } catch (e) {
        return 0;
    }
};

const formatTime = (minutes: number) => {
    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0 || h === 24) h = 12;
    if (h > 24) h -= 24; // Handle overlap to next day roughly
    return `${h}:${m.toString().padStart(2, '0')} ${period}`;
};

export default function ItineraryPage() {
    const {
        tripName,
        events, setEvents, deleteEvent, recordHistory,
        tripDates,
        selectedDayOffset,
        setSelectedDayOffset
    } = useTrip();

    const [category, setCategory] = useState<Category>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isUpdatingTraffic, setIsUpdatingTraffic] = useState(false);
    const [isControlsExpanded, setIsControlsExpanded] = useState(false);
    const [replacingEventId, setReplacingEventId] = useState<string | null>(null);
    const [isMoveDayModalOpen, setIsMoveDayModalOpen] = useState(false);

    const recalculateSchedule = (baseEvents?: TimelineEvent[]) => {
        const sourceEvents = baseEvents || events;
        const nextEvents = calculateScheduleForList(sourceEvents, [selectedDayOffset]);
        setEvents(nextEvents);
    };

    // Ensure we are on a valid day when visiting itinerary
    useEffect(() => {
        if (selectedDayOffset === -1) {
            setSelectedDayOffset(0);
        }
    }, [selectedDayOffset, setSelectedDayOffset]);

    const handleTimeChange = (id: string, newHHMM: string) => {
        const minutes = parseTime(newHHMM);
        const formattedTime = formatTime(minutes);

        const index = events.findIndex(e => e.id === id);
        if (index === -1) return;

        const newEventsList = [...events];
        newEventsList[index] = { ...newEventsList[index], time: formattedTime };

        // Pass the updated list directly to avoid stale state issues
        recalculateSchedule(newEventsList);
    };

    const handleBufferChange = (id: string, newBuffer: number) => {
        const index = events.findIndex(e => e.id === id);
        if (index === -1) return;

        const newEventsList = [...events];
        newEventsList[index] = { ...newEventsList[index], parkingBuffer: newBuffer };

        recalculateSchedule(newEventsList);
    };

    const handleDurationChange = (id: string, newDuration: string) => {
        const index = events.findIndex(e => e.id === id);
        if (index === -1) return;

        const newEventsList = [...events];
        newEventsList[index] = { ...newEventsList[index], duration: newDuration };

        recalculateSchedule(newEventsList);
    };


    const handleReorder = (newOrder: TimelineEvent[]) => {
        // We only want to reorder the events that are currently visible/filtered
        // But we must preserve the others.

        // 1. Identify IDs of currently filtered events
        const currentIds = new Set(filteredEvents.map(e => e.id));

        // 2. Get events that are NOT in the current view
        const otherEvents = events.filter(e => !currentIds.has(e.id));

        // 3. Combine others + new order
        // Note: usage of 'setEvents' with Reorder must be synchronous or immediate for smooth drag
        // Framer Motion Reorder updates the passed 'values' array optimistically during drag?
        // Actually, onReorder is called with the new array.
        setEvents([...otherEvents, ...newOrder]);
    };

    // Undo History State
    const [_history, setHistory] = useState<TimelineEvent[][]>([]);

    // Edit Mode State
    const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

    // Selector Modal State
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    const addToHistory = (currentEvents: TimelineEvent[]) => {
        setHistory(prev => {
            const newHistory = [...prev, currentEvents];
            if (newHistory.length > 5) {
                return newHistory.slice(newHistory.length - 5);
            }
            return newHistory;
        });
    };

    // We store the insert index to know where to place the new item
    const [insertIndex, setInsertIndex] = useState<number | null>(null);

    const handleOptimize = async () => {
        setIsOptimizing(true);
        addToHistory(events);

        try {
            const currentDayEvents = events.filter(e => e.dayOffset === selectedDayOffset);
            const otherEvents = events.filter(e => e.dayOffset !== selectedDayOffset);

            // Call Real Optimization API (with reorder)
            // Check if we have an END event
            const hasEndEvent = currentDayEvents.some(e => e.isEnd);

            const optimizedDay = await optimizeRoute(currentDayEvents, { fixEnd: hasEndEvent });

            // Re-calculate timestamps based on new order and real travel times
            if (optimizedDay.length > 0) {
                let currentTime = parseTime(optimizedDay[0].time); // Preserve start time of the day

                const finalOptimizedDay = optimizedDay.map((event: TimelineEvent, index: number) => {
                    // Update start time
                    const updatedEvent = { ...event, time: formatTime(currentTime) };

                    // 1. If this event has travelTime (meaning travel FROM prev to THIS), add to currentTime.
                    if (index > 0 && event.travelTime) {
                        currentTime += parseDuration(event.travelTime);
                    }

                    // 2. Set Start Time
                    updatedEvent.time = formatTime(currentTime);

                    // 3. Add Duration of THIS event to advance currentTime
                    const duration = parseDuration(event.duration);
                    currentTime += duration;

                    return updatedEvent;
                });

                setEvents([...otherEvents, ...finalOptimizedDay]);
            }

        } catch (error) {
            console.error("Optimization failed", error);
            // Alert user so they know it didn't work
            alert('Optimization Error: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleUpdateTraffic = async () => {
        setIsUpdatingTraffic(true);
        addToHistory(events);
        try {
            const currentDayEvents = events.filter(e => e.dayOffset === selectedDayOffset);
            const otherEvents = events.filter(e => e.dayOffset !== selectedDayOffset);

            // Call Real Optimization API (preserve order)
            // Check if we have an END event
            const hasEndEvent = currentDayEvents.some(e => e.isEnd);
            const trafficUpdatedEvents = await optimizeRoute(currentDayEvents, { preserveOrder: true, fixEnd: hasEndEvent });

            if (trafficUpdatedEvents.length > 0) {
                let currentTime = parseTime(trafficUpdatedEvents[0].time); // Preserve start time

                const finalEvents = trafficUpdatedEvents.map((event: TimelineEvent, index: number) => {
                    // Preserve congestion and travelTime from API
                    const updatedEvent = {
                        ...event,
                        time: formatTime(currentTime),
                        congestion: event.congestion, // Explicit copy
                        travelTime: event.travelTime   // Explicit copy
                    };

                    if (index > 0 && event.travelTime) {
                        currentTime += parseDuration(event.travelTime);
                    }

                    updatedEvent.time = formatTime(currentTime);

                    const duration = parseDuration(event.duration);
                    currentTime += duration;

                    return updatedEvent;
                });

                setEvents([...otherEvents, ...finalEvents]);
            }
        } catch (error) {
            console.error("Traffic update failed", error);
        } finally {
            setIsUpdatingTraffic(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Transport': return <Plane size={18} />;
            case 'Eat': return <Coffee size={18} />;
            case 'Stay': return <Bed size={18} />;
            default: return <MapPin size={18} />;
        }
    };

    const handleCheckIn = (id: string) => {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;

        setEvents(prev => {
            const index = prev.findIndex(e => e.id === id);
            if (index === -1) return prev;

            const nextEvents = [...prev];
            const currentEvent = nextEvents[index];

            if (currentEvent.status === 'Checked In') {
                // Toggle OFF: Revert to Scheduled, keep current time
                nextEvents[index] = { ...currentEvent, status: 'Scheduled' };
            } else {
                // Toggle ON: Set to Checked In, update time to NOW
                nextEvents[index] = { ...currentEvent, status: 'Checked In', time: timeString };
            }

            let duration = parseDuration(nextEvents[index].duration || '60m');
            // If checking in (or scheduled), we assume it takes the full duration
            if (nextEvents[index].status === 'Skipped') duration = 0;

            let cursorTime = parseTime(nextEvents[index].time) + duration;

            for (let i = index + 1; i < nextEvents.length; i++) {
                const evt = nextEvents[i];
                const travel = parseDuration(evt.travelTime);
                const newStart = cursorTime + travel;

                nextEvents[i] = { ...evt, time: formatTime(newStart) };

                let dur = parseDuration(evt.duration || '60m');
                if (evt.status === 'Skipped') dur = 0;
                cursorTime = newStart + dur;
            }
            return nextEvents;
        });
    };

    const handleSkip = async (id: string) => {
        // 1. Optimistic Update: Toggle Status & Naive Recalc
        const updatedEvents = [...events];
        const index = updatedEvents.findIndex(e => e.id === id);
        if (index === -1) return;

        const currentEvent = updatedEvents[index];
        const newStatus = currentEvent.status === 'Skipped' ? 'Scheduled' : 'Skipped';

        // Update status
        updatedEvents[index] = { ...currentEvent, status: newStatus };

        // Naive Time Recalculation (Local)
        const recalculateLocal = (evts: TimelineEvent[]) => {
            if (!evts || evts.length === 0) return evts;
            let cursorTime = parseTime(evts[0].time);

            return evts.map((event, i) => {
                if (i > 0) {
                    const travelMins = parseDuration(event.travelTime);
                    const startTime = cursorTime + travelMins;
                    event = { ...event, time: formatTime(startTime) };
                    cursorTime = startTime;
                } else {
                    cursorTime = parseTime(event.time);
                }

                let durationMins = parseDuration(event.duration || '60m');
                if (event.status === 'Skipped') durationMins = 0;
                cursorTime += durationMins;
                return event;
            });
        };

        const naiveUpdated = recalculateLocal(updatedEvents);
        setEvents(naiveUpdated);

        // 2. Async Traffic Recalculation
        // Only run if we have valid non-skipped events to route between
        setIsUpdatingTraffic(true);
        try {
            const currentDay = currentEvent.dayOffset || 0;
            // Filter only ACTIVE events for routing
            const activeDayEvents = naiveUpdated.filter(e =>
                (e.dayOffset || 0) === currentDay && e.status !== 'Skipped'
            );

            // We need at least 2 events to calculate a route
            if (activeDayEvents.length >= 2) {
                const optimizedEvents = await optimizeRoute(activeDayEvents, { preserveOrder: true });

                setEvents(prev => {
                    // Create map of updated traffic data
                    const trafficMap = new Map();
                    optimizedEvents.forEach(e => {
                        trafficMap.set(e.id, {
                            travelTime: e.travelTime,
                            congestion: e.congestion,
                            travelDistance: e.travelDistance
                        });
                    });

                    // Apply to current state
                    const mergedEvents = prev.map(e => {
                        if (trafficMap.has(e.id)) {
                            const traffic = trafficMap.get(e.id);
                            return { ...e, ...traffic };
                        }
                        return e;
                    });

                    // Re-run time calc with new travel times
                    return recalculateLocal(mergedEvents);
                });
            }
        } catch (error) {
            console.error("Failed to recalculate traffic on skip:", error);
        } finally {
            setIsUpdatingTraffic(false);
        }
    };

    const handleDescriptionChange = (id: string, newDescription: string) => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, description: newDescription } : e));
    };

    const handleDescriptionSave = async (id: string, newDescription: string) => {
        try {
            await db.updateEvent(id, { description: newDescription });
        } catch (error) {
            console.error('Failed to save description:', error);
        }
    };

    const handleSaveActivity = async (activityData: NewActivity) => {
        const targetOffset = selectedDayOffset;

        // Force browser to acknowledge execution
        // alert('DEBUG: Saving Activity - OPENING HOURS: ' + (activityData.openingHours?.length || 'NONE'));
        console.log('### ITINERARY-V5-FINAL ###');
        console.log('!!! [ItineraryPage] handleSaveActivity:', activityData);
        if (activityData.openingHours) {
            console.log('!!! [ItineraryPage] HAS OPENING HOURS');
        } else {
            console.warn('!!! [ItineraryPage] MISSING OPENING HOURS');
        }

        addToHistory(events); // Save state

        if (editingEvent && activityData.id) {
            // UPDATE existing event
            // We need to access 'events' state, but better to use functional update to be safe?
            // Actually, 'events' is available in scope.
            // BUT, if we use 'events' from scope, it might be stale?
            // Safer to use functional update, but then we can't extract the result easily.
            // Compromise: We will trust 'events' is relatively fresh or use a temp variable pattern if possible.
            // React batching means 'events' in this closure might be old if rapid updates happen.
            // However, for a modal save, it's usually fine.

            // Let's do the Calculate-First approach using current 'events' state,
            // but we really should use the prev value.
            // To do this correctly with hooks + side-effect (recalc):

            setEvents(prev => {
                const updated = prev.map(e => {
                    // Match by Day Offset
                    const isSameDay = (e.dayOffset ?? 0) === (targetOffset ?? 0);

                    if (isSameDay && e.id !== activityData.id) {
                        // Clear existing Start if new one is being set
                        if (activityData.isStart && e.isStart) return { ...e, isStart: false };
                        // Clear existing End if new one is being set
                        if (activityData.isEnd && e.isEnd) return { ...e, isEnd: false };
                    }

                    return e.id === activityData.id
                        ? { ...e, ...activityData, dayOffset: e.dayOffset }
                        : e;
                });
                // Trigger recalc on this new list
                // We MUST defer this to avoid "cannot update during render" if recalc triggers another setEvents
                // But recalculateSchedule calls setEvents internally!
                // So we cannot call it inside the reducer.

                // Solution: Compute locally, call setEvents ONCE with the recalculation result.

                // 1. Compute the basic update
                // 2. Pass to recalculate logic which returns the fully schedule-adjusted list
                // 3. Return THAT.

                // We need to lift 'recalculateSchedule' logic to return a value, not just set state.
                // Refactoring recalculateSchedule to pure function is best.
                // For now, let's replicate the logic or create a helper that returns the list.

                const updatedEvent = updated.find(e => e.id === editingEvent!.id);
                if (updatedEvent) recordHistory('update', updatedEvent, 'Activity details modified');
                return calculateScheduleForList(updated, [selectedDayOffset]);
            });

            setEditingEvent(null);
        } else {
            // CREATE new event
            console.log('!!! [ItineraryPage] Creating event with oh:', activityData.openingHours?.length);
            const newEvent: TimelineEvent = {
                id: uuidv4(),
                ...activityData,
                description: '', // Default note input to empty so placeholder shows "Add note.."
                openingHours: activityData.openingHours,
                dayOffset: targetOffset
            };

            setEvents(prev => {
                let nextEvents: TimelineEvent[];
                if (insertIndex !== null) {
                    const thisDayEvents = prev.filter(e => (e.dayOffset ?? 0) === targetOffset);
                    const otherEvents = prev.filter(e => (e.dayOffset ?? 0) !== targetOffset);
                    const newDayList = [...thisDayEvents];
                    newDayList.splice(insertIndex, 0, newEvent);
                    nextEvents = [...otherEvents, ...newDayList];
                } else {
                    nextEvents = [...prev, newEvent];
                }

                recordHistory('add', newEvent, 'New activity added to itinerary');
                return calculateScheduleForList(nextEvents, [selectedDayOffset]);
            });
            setInsertIndex(null);
        }
    };

    const handleDeleteEvent = (id: string) => {
        const comment = window.prompt('Why are you removing this activity? (Optional)', 'No longer fits schedule');
        if (comment !== null) {
            deleteEvent(id, comment);
        }
    };

    const handleReplace = (id: string) => {
        setReplacingEventId(id);
        setIsSelectorOpen(true);
    };

    const handleSelectFromLibrary = (place: TimelineEvent, durationMins: number, isStart: boolean, isEnd: boolean) => {
        const targetDay = selectedDayOffset;

        if (replacingEventId) {
            setEvents(prev => {
                const updated = prev.map(e => e.id === replacingEventId ? {
                    ...place,
                    id: replacingEventId, // Maintain stability
                    status: 'Scheduled',
                    dayOffset: e.dayOffset,
                    duration: durationMins < 60 ? `${durationMins}m` : `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`,
                    time: e.time, // Preserve time for now, or use recalculate
                    isStart: isStart || e.isStart,
                    isEnd: isEnd || e.isEnd,
                    description: '', // Reset notes
                } : e);
                const result = calculateScheduleForList(updated, [selectedDayOffset]);
                const replacedEvent = updated.find(e => e.id === replacingEventId);
                if (replacedEvent) {
                    recordHistory('update', replacedEvent, 'Activity replaced from library');
                }
                return result;
            });
            setReplacingEventId(null);
            setIsSelectorOpen(false);
            return;
        }

        const createEvent = (isStartFlag: boolean, isEndFlag: boolean): TimelineEvent => ({
            ...place,
            id: uuidv4(), // New ID for the instance
            status: 'Scheduled',
            description: '', // Default note input to empty so placeholder shows "Add note.."
            dayOffset: targetDay,
            duration: durationMins < 60 ? `${durationMins}m` : `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`,
            time: isStartFlag ? '08:00 AM' : '09:00 AM', // Start items start earlier
            isStart: isStartFlag,
            isEnd: isEndFlag
        });

        setEvents(prev => {
            const currentDayEvents = prev.filter(e => (e.dayOffset ?? 0) === targetDay);
            const otherEvents = prev.filter(e => (e.dayOffset ?? 0) !== targetDay);

            // Replaces the current start or end card's anchor status
            let newDayList: TimelineEvent[] = currentDayEvents.map(e => ({
                ...e,
                isStart: isStart ? false : e.isStart,
                isEnd: isEnd ? false : e.isEnd
            }));

            const addEventNormal = (evt: TimelineEvent) => {
                // If the LAST item is an END item, insert before it
                const lastItem = newDayList[newDayList.length - 1];
                if (lastItem && lastItem.isEnd) {
                    if (insertIndex !== null && insertIndex < newDayList.length) {
                        newDayList.splice(insertIndex, 0, evt);
                    } else {
                        newDayList.splice(newDayList.length - 1, 0, evt);
                    }
                } else {
                    if (insertIndex !== null && insertIndex <= newDayList.length) {
                        newDayList.splice(insertIndex, 0, evt);
                    } else {
                        newDayList.push(evt);
                    }
                }
            };

            // 1. Handle START Insertion
            if (isStart) {
                const startEvent = createEvent(true, false);
                newDayList.unshift(startEvent);
            }

            // 2. Handle END Insertion
            // If it's BOTH Start AND End, we add a SECOND event at the end
            if (isEnd) {
                const endEvent = createEvent(false, true);
                newDayList.push(endEvent);
            }

            // 3. Normal Insertion
            if (!isStart && !isEnd) {
                const normalEvent = createEvent(false, false);
                addEventNormal(normalEvent);
            }

            const resultEvents = calculateScheduleForList([...otherEvents, ...newDayList], [selectedDayOffset]);
            // Find what was added (events that weren't in prev)
            const addedItems = newDayList.filter(item => !currentDayEvents.some(old => old.id === item.id));
            addedItems.forEach(item => recordHistory('add', item, 'Place added from library'));
            return resultEvents;
        });

        // DO NOT CLOSE SELECTOR
        // setIsSelectorOpen(false); 
        // We also probably shouldn't reset insertIndex if we want to keep adding?
        // But if we insert multiple, the index moves.
        // Let's reset insertIndex to null so subsequent adds go to end (unless user picked a specific slot, which is hard to persist)
        // Actually, if I keep adding, I probably want to append.
        setInsertIndex(null);
    };

    const openSelectorAt = (index: number) => {
        setInsertIndex(index);
        setIsSelectorOpen(true);
    };

    const openAddModal = () => {
        setIsSelectorOpen(false); // Close selector
        setEditingEvent(null);
        setIsModalOpen(true);
    };

    const handleMoveDay = (targetOffset: number) => {
        if (targetOffset === selectedDayOffset) {
            setIsMoveDayModalOpen(false);
            return;
        }

        if (window.confirm(`Move all activities from Day ${selectedDayOffset + 1} to Day ${targetOffset + 1}?`)) {
            addToHistory(events);
            setEvents(prev => {
                const updated = prev.map(e =>
                    e.dayOffset === selectedDayOffset ? { ...e, dayOffset: targetOffset } : e
                );
                // Record the move in history for one of the items or a summary
                const movedCount = updated.filter(e => e.dayOffset === targetOffset && !prev.find(p => p.id === e.id && p.dayOffset === targetOffset)).length;
                if (movedCount > 0) {
                    recordHistory('move', { title: `Day ${selectedDayOffset + 1} Activities` } as any, `Moved ${movedCount} items to Day ${targetOffset + 1}`);
                }
                // Also recalculate the target day to ensure schedule is valid
                return calculateScheduleForList(updated, [targetOffset]);
            });
            setSelectedDayOffset(targetOffset);
            setIsMoveDayModalOpen(false);
        }
    };

    const openEditModal = (event: TimelineEvent) => {
        if (!isEditing) return; // Only allow editing specific items when in Edit Mode
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const filteredEvents = events.filter(e => {
        const matchesCategory = category === 'All' || e.type === category;
        const matchesDate = selectedDayOffset === -1 || e.dayOffset === selectedDayOffset;
        return matchesCategory && matchesDate;
    });

    // Filter "Saved" places AND all unique history for the selector library
    // EXCLUDING places that are already added to the currently selected day
    const savedPlaces = useMemo(() => {
        // Build the unique library from all historical events
        const unique = new Map();
        events.forEach(e => {
            // Deduplicate by placeId (strongest) or title/link
            const key = e.placeId || e.googleMapsLink || e.title;

            if (key && !unique.has(key)) {
                unique.set(key, e);
            }
        });
        return Array.from(unique.values());
    }, [events]);

    const getFormattedDateRange = () => {
        if (tripDates.length === 0) return '';
        const start = tripDates[0].dateObj;
        const end = tripDates[tripDates.length - 1].dateObj;
        return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    };

    // Background Image Cycling
    const validImages = events.map(e => e.image).filter((img): img is string => !!img);
    const [bgIndex, setBgIndex] = useState(0);

    const { scrollY } = useScroll();

    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    useEffect(() => {
        if (validImages.length <= 1) return;
        const interval = setInterval(() => {
            setBgIndex(prev => (prev + 1) % validImages.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [validImages.length]);

    // Scroll-based Collapse & Auto-Expand Logic - Removed to allow manual control only

    // Calculate Stats
    const stats = useMemo(() => {
        let destinations = 0;
        let roadMinutes = 0;
        let spotMinutes = 0;

        filteredEvents.forEach(e => {
            destinations++;

            // Spot Time
            if (e.status !== 'Skipped') {
                spotMinutes += parseDuration(e.duration);
            }

            // Road Time
            if (e.travelTime) {
                roadMinutes += parseDuration(e.travelTime);
            }
        });

        const totalMinutes = roadMinutes + spotMinutes;

        const formatDurationShort = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
        };

        return {
            destinations,
            roadTime: formatDurationShort(roadMinutes),
            spotTime: formatDurationShort(spotMinutes),
            totalTime: formatDurationShort(totalMinutes)
        };
    }, [filteredEvents]);

    // Real-time Clock
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const [isDateSelectorExpanded, setIsDateSelectorExpanded] = useState(true);

    // Helper to format real-time header
    const formatRealTime = (date: Date) => {
        let h = date.getHours();
        const m = date.getMinutes();
        const period = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;

        const timeStr = `${h}:${m.toString().padStart(2, '0')} ${period}`;
        // E.g. "Mon, 12 Feb"
        const dateStr = `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

        return { timeStr, dateStr };
    };

    // ... existing stats logic ...

    return (
        <Layout>
            {/* ... Modal ... */}

            <AddActivityModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
                onSave={handleSaveActivity}
                initialData={editingEvent}
            />

            <PlaceSelectorModal
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                savedPlaces={savedPlaces}
                onSelectPlace={handleSelectFromLibrary}
                onAddNew={openAddModal}
            />

            {/* Header Area */}
            <header className="relative z-10 min-h-[280px] flex flex-col justify-end p-6 overflow-hidden">
                {/* Background Image */}
                <motion.div
                    style={{ y: isEditing ? '0%' : bgY, opacity: bgOpacity }}
                    className="absolute inset-0 z-0 bg-zinc-900"
                >
                    <AnimatePresence mode='popLayout'>
                        {validImages.length > 0 ? (
                            <motion.img
                                key={validImages[bgIndex]}
                                src={validImages[bgIndex]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.5 }}
                                alt="Trip Header"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <motion.img
                                key="default-bali"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.5 }}
                                src="https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1920&q=80"
                                alt="Bali Landscape"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className="absolute inset-0 bg-[#0B1221]/40 z-10 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10 pointer-events-none h-full translate-y-1" />

                <div className="relative z-10 flex justify-between items-end pb-8">
                    <div>
                        <h1 className="text-3xl font-['Playfair_Display'] font-black text-white mb-2 leading-tight drop-shadow-md">{tripName}</h1>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center text-white/70 text-xs gap-2 font-medium drop-shadow-sm">
                                <Calendar size={12} />
                                <span>{getFormattedDateRange()}</span>
                            </div>
                            {/* Real Time Clock */}
                            <div className="flex items-center text-white text-sm gap-2 font-bold drop-shadow-sm mt-1">
                                <Clock size={14} className="text-[#007AFF]" />
                                <span>{formatRealTime(now).timeStr}</span>
                                <span className="text-white/40">|</span>
                                <span className="text-white/90">{formatRealTime(now).dateStr}</span>
                            </div>
                        </div>
                    </div>
                    {/* User Avatar / Profile - Removed Settings Button */}
                </div>
            </header>

            {/* Sticky Actions Bar */}
            <div className="sticky top-0 z-30 transition-all -mt-5">
                <div className="bg-zinc-50/95 backdrop-blur-xl border-b border-zinc-200 shadow-sm rounded-t-[2rem] overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
                    {/* Trip Summary Stats - Always Visible */}
                    <div className="px-6 pt-5 pb-4 border-b border-zinc-100">
                        <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-[0.15em] mb-3 text-center">
                            Day {selectedDayOffset + 1} Summary
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                <div className="text-[#007AFF] mb-1 opacity-80"><MapPin size={14} /></div>
                                <div className="text-sm font-bold text-zinc-900">{stats.destinations}</div>
                                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Places</div>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                <div className="text-[#007AFF] mb-1 opacity-80"><Clock size={14} /></div>
                                <div className="text-sm font-bold text-zinc-900">{stats.totalTime}</div>
                                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Total</div>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                <div className="text-[#007AFF] mb-1 opacity-80"><CarFront size={14} /></div>
                                <div className="text-sm font-bold text-zinc-900">{stats.roadTime}</div>
                                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Road</div>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                <div className="text-[#007AFF] mb-1 opacity-80"><Hourglass size={14} /></div>
                                <div className="text-sm font-bold text-zinc-900">{stats.spotTime}</div>
                                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Spot</div>
                            </div>
                        </div>
                    </div>

                    {/* Check/Collapse Toggle Area */}
                    <div
                        className="w-full flex justify-center pt-1 pb-1 cursor-pointer active:opacity-70 transition-opacity"
                        onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                    >
                        <div className="w-16 h-5 flex items-center justify-center bg-zinc-100/50 rounded-full text-zinc-400 hover:text-[#007AFF] transition-colors">
                            {isControlsExpanded ? <ChevronDown size={14} strokeWidth={2.5} /> : <ChevronUp size={14} strokeWidth={2.5} />}
                        </div>
                    </div>

                    <AnimatePresence>
                        {isControlsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >

                                {/* Controls Group (Grey Background) */}
                                <div className="bg-zinc-50/80 border-t border-zinc-200">
                                    {/* Category Section */}
                                    <div className="pt-3.5">
                                        <div className="px-6 mb-1">
                                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-[0.15em]">Category Filter</span>
                                        </div>
                                        <div className="pb-3">
                                            <CategoryFilter selected={category} onSelect={setCategory} />
                                        </div>
                                    </div>

                                    {/* Actions Bar inside Collapsible */}
                                    <div className="px-6 py-4 border-t border-zinc-100/50">
                                        <div className="mb-2">
                                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-[0.15em]">Quick Actions</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 w-full">
                                            <button
                                                onClick={handleUpdateTraffic}
                                                disabled={isUpdatingTraffic}
                                                className={`
                                                h-14 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all shadow-sm w-full
                                                ${isUpdatingTraffic
                                                        ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-wait'
                                                        : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-900 active:scale-95'
                                                    }
                                            `}
                                            >
                                                <RefreshCcw size={14} className={isUpdatingTraffic ? 'animate-spin' : ''} />
                                                <span className="whitespace-nowrap uppercase tracking-tighter opacity-80">{isUpdatingTraffic ? 'Updating...' : 'Update Traffic'}</span>
                                            </button>

                                            <button
                                                onClick={handleOptimize}
                                                disabled={isOptimizing}
                                                className={`
                                                h-14 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all w-full
                                                ${isOptimizing
                                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 cursor-wait'
                                                        : 'bg-[#007AFF] text-white shadow-md shadow-blue-500/30 hover:bg-blue-600 hover:scale-105 active:scale-95'
                                                    }
                                            `}
                                            >
                                                <Sparkles size={14} className={isOptimizing ? 'animate-spin' : ''} />
                                                <span className="whitespace-nowrap uppercase tracking-tighter opacity-90">{isOptimizing ? 'Optimizing...' : 'Optimize Route'}</span>
                                            </button>

                                        </div>
                                    </div>
                                </div>


                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </div>

            <div className="px-4 pb-32 pt-8 min-h-[50vh] transition-all max-w-2xl mx-auto">
                {filteredEvents.length > 0 ? (
                    <Reorder.Group
                        axis="y"
                        values={filteredEvents}
                        onReorder={handleReorder}
                        className="space-y-0"
                    >
                        <AnimatePresence mode='popLayout'>
                            {filteredEvents.map((event, index) => (
                                <DraggableTimelineItem
                                    key={event.id}
                                    event={event}
                                    index={index}
                                    isEditing={isEditing}
                                    isLast={index === filteredEvents.length - 1}
                                    isFirst={index === 0}
                                    icon={getIcon(event.type)}
                                    nextCongestion={filteredEvents[index + 1]?.congestion}
                                    selectedDayName={tripDates.find(d => d.offset === (event.dayOffset ?? 0))?.dayName}
                                    openSelectorAt={openSelectorAt}
                                    openEditModal={openEditModal}
                                    handleDeleteEvent={handleDeleteEvent}
                                    onCheckIn={handleCheckIn}
                                    onSkip={handleSkip}
                                    onTimeChange={handleTimeChange}
                                    onBufferChange={handleBufferChange}
                                    onDurationChange={handleDurationChange}
                                    onDescriptionChange={handleDescriptionChange}
                                    onDescriptionSave={handleDescriptionSave}
                                    onDelete={handleDeleteEvent}
                                    onReplace={handleReplace}
                                />
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
                            <MapPin size={24} className="text-[#007AFF]" />
                        </div>
                        <button
                            onClick={() => openSelectorAt(0)}
                            className="px-8 py-3 bg-[#007AFF] text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-[#0071EB] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={16} strokeWidth={3} />
                            Add First Activity
                        </button>
                    </div>
                )
                }

                {/* Final Insert Zone at the end */}
                {
                    isEditing && filteredEvents.length > 0 && (
                        <div
                            onClick={() => openSelectorAt(filteredEvents.length)}
                            className="h-12 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-sm font-bold text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 cursor-pointer transition-all mt-4"
                        >
                            + Add to End
                        </div>
                    )
                }
            </div >

            {/* Move Day Modal */}
            <AnimatePresence>
                {isMoveDayModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMoveDayModalOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-zinc-900">Move Day {selectedDayOffset + 1} To...</h3>
                                    <button onClick={() => setIsMoveDayModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pb-2">
                                    {tripDates.map((dateObj) => (
                                        <button
                                            key={dateObj.offset}
                                            onClick={() => handleMoveDay(dateObj.offset)}
                                            disabled={dateObj.offset === selectedDayOffset}
                                            className={`
                                                p-4 rounded-2xl border text-left transition-all
                                                ${dateObj.offset === selectedDayOffset
                                                    ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed'
                                                    : 'bg-white border-zinc-200 text-zinc-900 hover:border-[#007AFF] hover:bg-blue-50/50 active:scale-95'
                                                }
                                            `}
                                        >
                                            <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1">Day {dateObj.offset + 1}</div>
                                            <div className="font-bold text-sm">{dateObj.dateNum} {MONTHS[dateObj.dateObj.getUTCMonth()]}</div>
                                            <div className="text-xs text-zinc-500">{dateObj.dayName}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bottom Right Date Selector & Edit Mode - Unified Collapsible Pill */}
            <div className="fixed bottom-28 left-4 right-4 z-40 pointer-events-none flex justify-end">
                <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30, shadow: { duration: 0.2 } }}
                    className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-[1.75rem] shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-zinc-100 flex items-center p-1.5 gap-1"
                >
                    {/* Edit Mode Toggle - Now at Bottom Left of Pill */}
                    <button
                        onClick={() => {
                            if (isEditing) recalculateSchedule();
                            setIsEditing(!isEditing);
                        }}
                        className={`
                            w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all active:scale-90 flex-shrink-0
                            ${isEditing ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}
                        `}
                    >
                        {isEditing ? <Check size={18} /> : <Pencil size={18} />}
                        <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5 line-clamp-1">
                            {isEditing ? 'Done' : 'Edit'}
                        </span>
                    </button>

                    {isEditing && (
                        <button
                            onClick={() => setIsMoveDayModalOpen(true)}
                            className="w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all active:scale-90 flex-shrink-0 text-zinc-500 hover:bg-zinc-100"
                        >
                            <CalendarDays size={18} />
                            <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5 line-clamp-1">
                                Move
                            </span>
                        </button>
                    )}

                    <div className="w-px h-6 bg-zinc-200 mx-1 flex-shrink-0" />

                    <AnimatePresence initial={false}>
                        {isDateSelectorExpanded && (
                            <motion.div
                                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                                animate={{ width: "auto", opacity: 1, marginRight: 8 }}
                                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden flex-1 min-w-0"
                            >
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 py-0.5 max-w-[calc(100vw-13rem)] md:max-w-none overscroll-contain touch-pan-x">
                                    {tripDates.map((dateItem) => {
                                        const isSelected = selectedDayOffset === dateItem.offset;
                                        const today = new Date();
                                        const checkDate = new Date(dateItem.dateObj);
                                        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                        const startOfCheck = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
                                        const isPast = startOfCheck < startOfToday;

                                        return (
                                            <button
                                                key={dateItem.offset}
                                                onClick={() => setSelectedDayOffset(dateItem.offset)}
                                                className={`
                                                    flex flex-col items-center justify-center min-w-[3rem] h-12 rounded-[1rem] transition-all duration-200
                                                    ${isSelected
                                                        ? 'bg-[#007AFF] text-white shadow-md shadow-blue-500/25 scale-100'
                                                        : isPast
                                                            ? 'bg-transparent text-zinc-300 hover:text-zinc-400'
                                                            : 'bg-transparent text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
                                                    }
                                                `}
                                            >
                                                <span className="text-[8px] font-bold uppercase tracking-wider opacity-90">{dateItem.dayName}</span>
                                                <span className={`text-base font-bold leading-none mt-0.5 ${isSelected ? 'text-white' : (isPast ? 'text-zinc-300' : 'text-zinc-600')}`}>{dateItem.dateNum}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Toggle Button - Now part of the same pill */}
                    <button
                        onClick={() => setIsDateSelectorExpanded(!isDateSelectorExpanded)}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-zinc-500 hover:text-[#007AFF] transition-all active:scale-95 flex-shrink-0"
                    >
                        {isDateSelectorExpanded ? <ChevronDown className="rotate-90" size={20} /> : <Calendar size={20} />}
                    </button>
                </motion.div>
            </div>
        </Layout >
    );
}

function DraggableTimelineItem({
    event,
    index,
    isEditing,
    isLast,
    isFirst,
    icon,
    nextCongestion,
    selectedDayName,
    openSelectorAt,
    openEditModal,
    handleDeleteEvent,
    onCheckIn,
    onSkip,
    onTimeChange,
    onBufferChange,
    onDurationChange,
    onDescriptionChange,
    onDescriptionSave,
    onDelete,
    onReplace
}: any) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={event}
            dragListener={false}
            dragControls={controls}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative"
        >
            {/* Insert Zone BEFORE item (Only if not first item, or if in editing mode) */}
            {(isEditing || index > 0) && (
                <div
                    onClick={() => openSelectorAt(index)}
                    className={`
                        flex items-center justify-center group/insert cursor-pointer transition-all
                        ${isEditing ? 'h-10 my-2' : 'h-8 -my-4 relative z-20'}
                    `}
                >
                    {isEditing ? (
                        <div className="h-[2px] w-full bg-zinc-200 group-hover/insert:bg-zinc-300 rounded-full relative transition-all">
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-900 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg scale-100 transition-transform flex items-center gap-1">
                                <Plus size={10} strokeWidth={3} /> INSERT HERE
                            </div>
                        </div>
                    ) : (
                        <div className="w-6 h-6 bg-white border-2 border-zinc-100 text-[#007AFF] rounded-full flex items-center justify-center shadow-md hover:bg-[#007AFF] hover:text-white hover:border-[#007AFF] hover:scale-110 transition-all">
                            <Plus size={14} strokeWidth={3} />
                        </div>
                    )}
                </div>
            )}

            <div className="relative group flex items-stretch">
                {/* Drag Handle - Left Side Layout for Alignment */}
                {isEditing && (
                    <div
                        className="flex flex-col justify-center items-center pr-2 cursor-grab active:cursor-grabbing touch-none select-none"
                        onPointerDown={(e) => controls.start(e)}
                    >
                        <div className="p-3 bg-zinc-100 rounded-xl hover:bg-zinc-200 text-zinc-400 transition-colors">
                            <GripVertical size={20} />
                        </div>
                    </div>
                )}

                <div
                    className="flex-1 min-w-0"
                    onClick={() => isEditing && openEditModal(event)}
                >
                    <TimelineItem
                        event={event}
                        isLast={isLast}
                        isFirst={isFirst}
                        isCompact={isEditing}
                        icon={icon}
                        nextCongestion={nextCongestion}
                        onCheckIn={onCheckIn}
                        onSkip={onSkip}
                        onTimeChange={onTimeChange}
                        onBufferChange={onBufferChange}
                        onDurationChange={onDurationChange}
                        onDescriptionChange={onDescriptionChange}
                        onDescriptionSave={onDescriptionSave}
                        onDelete={onDelete}
                        onReplace={onReplace}
                        selectedDayName={selectedDayName}
                    />
                    {isEditing && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                            className="absolute -right-2 -top-2 w-7 h-7 bg-white text-zinc-900 border border-zinc-200 rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-90 transition-transform z-10"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>
        </Reorder.Item>
    );
}
