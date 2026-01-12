import { Layout } from '../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { uuidv4 } from '../lib/uuid';
import { Category, CategoryFilter } from '../components/CategoryFilter';
import { TimelineItem, TimelineEvent } from '../components/TimelineItem';
import { AddActivityModal, NewActivity } from '../components/AddActivityModal';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { Plus, Settings, Plane, Coffee, MapPin, Bed, Pencil, Check, X, Sparkles, ChevronUp, ChevronDown, RefreshCcw, Clock, CarFront, Hourglass } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent, Reorder } from 'framer-motion';
import { optimizeRoute } from '../lib/googleMaps';
import { PlaceSelectorModal } from '../components/PlaceSelectorModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Helper functions for time calculation
const parseTime = (str: string) => {
    try {
        const [time, period] = str.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    } catch (e) {
        return 9 * 60; // Default 9 AM
    }
};

const parseDuration = (str?: string) => {
    if (!str) return 60; // Default 1h
    try {
        const hMatch = str.match(/(\d+)h/);
        const mMatch = str.match(/(\d+)m/);
        let m = 0;
        if (hMatch) m += parseInt(hMatch[1]) * 60;
        if (mMatch) m += parseInt(mMatch[1]);
        return m || 60;
    } catch (e) {
        return 60;
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

const hhmmToMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

export default function ItineraryPage() {
    const {
        tripName, setTripName,
        startDate, setStartDate,
        tripDuration, setTripDuration,
        events, setEvents, deleteEvent,
        tripDates
    } = useTrip();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [category, setCategory] = useState<Category>('All');
    const [selectedDayOffsets, setSelectedDayOffsets] = useState<number[]>([0]); // 0-indexed day offsets
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isUpdatingTraffic, setIsUpdatingTraffic] = useState(false);
    const [isControlsExpanded, setIsControlsExpanded] = useState(true);

    const recalculateSchedule = (baseEvents?: TimelineEvent[]) => {
        const sourceEvents = baseEvents || events;
        const currentOffsets = new Set(selectedDayOffsets);

        const currentDayEvents = sourceEvents.filter(e => currentOffsets.has(e.dayOffset || 0));
        const otherEvents = sourceEvents.filter(e => !currentOffsets.has(e.dayOffset || 0));

        if (currentDayEvents.length === 0) return;

        let currentTime = parseTime(currentDayEvents[0].time);

        const updatedDayEvents = currentDayEvents.map((event, index) => {
            const parkingBuffer = event.parkingBuffer ?? 10;

            if (index > 0 && event.travelTime) {
                const travelMins = parseDuration(event.travelTime);
                // Add travel time + parking buffer to get to the location
                currentTime += (travelMins + parkingBuffer);
            }

            const newTimeStr = formatTime(currentTime);
            const duration = parseDuration(event.duration);

            // Note: currentTime tracks the 'end' of the activity (departure)
            currentTime += duration;

            return { ...event, time: newTimeStr };
        });

        setEvents([...otherEvents, ...updatedDayEvents]);
    };

    const handleTimeChange = (id: string, newHHMM: string) => {
        const minutes = hhmmToMinutes(newHHMM);
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

    const handleToggleEdit = () => {
        if (isEditing) {
            // User clicked "Done"
            recalculateSchedule();
        }
        setIsEditing(!isEditing);
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
            const currentDayEvents = events.filter(e => selectedDayOffsets.includes(e.dayOffset || 0));
            const otherEvents = events.filter(e => !selectedDayOffsets.includes(e.dayOffset || 0));

            // Call Real Optimization API (with reorder)
            const optimizedDay = await optimizeRoute(currentDayEvents);

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
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleUpdateTraffic = async () => {
        setIsUpdatingTraffic(true);
        addToHistory(events);
        try {
            const currentDayEvents = events.filter(e => selectedDayOffsets.includes(e.dayOffset || 0));
            const otherEvents = events.filter(e => !selectedDayOffsets.includes(e.dayOffset || 0));

            // Call Real Optimization API (preserve order)
            const trafficUpdatedEvents = await optimizeRoute(currentDayEvents, { preserveOrder: true });

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

    const handleSkip = (id: string) => {
        setEvents(prev => {
            // Toggle skip
            const updated = prev.map(e => e.id === id ? { ...e, status: (e.status === 'Skipped' ? 'Scheduled' : 'Skipped') as any } : e);

            // Recalculate full day
            if (!updated || updated.length === 0) return updated;
            let cursorTime = parseTime(updated[0].time); // Anchor to first event

            return updated.map((event, index) => {
                if (index > 0) {
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
        });
    };

    const toggleDate = (offset: number) => {
        // Single Select Mode
        setSelectedDayOffsets([offset]);
    };

    const handleAddActivity = (activityData: NewActivity) => {
        const targetOffset = selectedDayOffsets[0] || 0;

        addToHistory(events); // Save state

        if (editingEvent && activityData.id) {
            // UPDATE existing event
            setEvents(prev => prev.map(e =>
                e.id === activityData.id
                    ? { ...e, ...activityData, dayOffset: e.dayOffset }
                    : e
            ));
            setEditingEvent(null);
        } else {
            // CREATE new event
            const newEvent: TimelineEvent = {
                id: uuidv4(),
                ...activityData,
                dayOffset: targetOffset
            };

            setEvents(prev => {
                if (insertIndex !== null) {
                    const thisDayEvents = prev.filter(e => (e.dayOffset ?? 0) === targetOffset);
                    const otherEvents = prev.filter(e => (e.dayOffset ?? 0) !== targetOffset);
                    const newDayList = [...thisDayEvents];
                    newDayList.splice(insertIndex, 0, newEvent);
                    return [...otherEvents, ...newDayList];
                }
                return [...prev, newEvent];
            });
            setInsertIndex(null);
        }
    };

    const handleDeleteEvent = (id: string) => {
        if (window.confirm('Are you sure you want to remove this activity?')) {
            addToHistory(events); // Save current state before changing
            deleteEvent(id);
        }
    };

    const handleSelectFromLibrary = (place: TimelineEvent, durationMins: number) => {
        const targetDay = selectedDayOffsets[0] || 0;
        const newEvent: TimelineEvent = {
            ...place,
            id: uuidv4(), // New ID for the instance
            status: 'Scheduled',
            dayOffset: targetDay,
            duration: durationMins < 60 ? `${durationMins}m` : `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`,
            time: '09:00 AM' // Default time, logic can be smarter
        };

        setEvents(prev => {
            if (insertIndex !== null) {
                const currentDayEvents = prev.filter(e => (e.dayOffset ?? 0) === targetDay);
                const otherEvents = prev.filter(e => (e.dayOffset ?? 0) !== targetDay);
                const newDayList = [...currentDayEvents];
                newDayList.splice(insertIndex, 0, newEvent);
                return [...otherEvents, ...newDayList];
            }
            return [...prev, newEvent];
        });

        setIsSelectorOpen(false);
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

    const openEditModal = (event: TimelineEvent) => {
        if (!isEditing) return; // Only allow editing specific items when in Edit Mode
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const filteredEvents = events.filter(e => {
        const matchesCategory = category === 'All' || e.type === category;
        const matchesDate = selectedDayOffsets.includes(e.dayOffset ?? 0);
        return matchesCategory && matchesDate;
    });

    // Filter "Saved" places AND all unique history for the selector library
    // EXCLUDING places that are already added to the currently selected day
    const savedPlaces = useMemo(() => {
        const currentDay = selectedDayOffsets[0] || 0;

        // 1. Identify what is ON the current day (to exclude)
        const keysOnCurrentDay = new Set<string>();
        events.forEach(e => {
            if ((e.dayOffset ?? 0) === currentDay) {
                const key = e.placeId || e.googleMapsLink || e.title;
                if (key) keysOnCurrentDay.add(key);
            }
        });

        // 2. Build the unique library
        const unique = new Map();
        events.forEach(e => {
            // Deduplicate by placeId (strongest) or title/link
            const key = e.placeId || e.googleMapsLink || e.title;

            // Skip if it's already on the current day
            if (key && keysOnCurrentDay.has(key)) return;

            if (key && !unique.has(key)) {
                unique.set(key, e);
            }
        });
        return Array.from(unique.values());
    }, [events, selectedDayOffsets]);

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

    // Scroll-based Collapse & Auto-Expand Logic
    const [hasCollapsedOnScroll, setHasCollapsedOnScroll] = useState(false);
    useMotionValueEvent(scrollY, "change", (latest) => {
        const collapseThreshold = 100;
        const expandThreshold = 50;

        if (latest > collapseThreshold && !hasCollapsedOnScroll && isControlsExpanded) {
            setIsControlsExpanded(false);
            setHasCollapsedOnScroll(true);
        } else if (latest < expandThreshold) {
            // "Pull down" / Back to top -> Auto Expand
            if (!isControlsExpanded) {
                setIsControlsExpanded(true);
            }
            setHasCollapsedOnScroll(false);
        }
    });

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

    return (
        <Layout>
            <TripSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={(settings) => {
                    setTripName(settings.tripName);
                    setStartDate(new Date(settings.startDate));
                    setTripDuration(settings.duration);
                    setIsSettingsOpen(false);
                }}
                initialSettings={{
                    tripName,
                    startDate: startDate.toISOString().split('T')[0],
                    duration: tripDuration
                }}
            />

            <AddActivityModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
                onSave={handleAddActivity}
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
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <h3 className="text-zinc-700 font-bold text-xl tracking-[0.2em] animate-pulse">waiting for your plan...</h3>
                            </div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className="absolute inset-0 bg-[#0B1221]/40 z-10 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10 pointer-events-none h-full translate-y-1" />

                <div className="relative z-10 flex justify-between items-end pb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-white mb-1 leading-tight drop-shadow-md">{tripName}</h1>
                        <div className="flex items-center text-white/90 text-xs gap-2 font-medium drop-shadow-sm">
                            <span>{getFormattedDateRange()}</span>
                        </div>
                    </div>
                    {/* User Avatar / Profile */}
                    {/* Settings Button (Replaces Avatar) */}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-md hover:bg-white/20 active:scale-95 transition-all"
                    >
                        <Settings size={18} strokeWidth={2} />
                    </button>
                </div>
            </header>

            {/* Sticky Actions Bar */}
            <div className="sticky top-0 z-30 transition-all -mt-5">
                <div className="bg-zinc-50/95 backdrop-blur-xl border-b border-zinc-200 shadow-sm rounded-t-[2rem] overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
                    {/* Check/Collapse Toggle Area */}
                    <div
                        className="w-full flex justify-center pt-3 pb-1 cursor-pointer active:opacity-70 transition-opacity"
                        onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                    >
                        <div className="w-16 h-6 flex items-center justify-center bg-zinc-100/50 rounded-full text-zinc-400 hover:text-[#007AFF] transition-colors">
                            {isControlsExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
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
                                {/* Trip Summary Stats */}
                                <div className="px-6 py-4 border-b border-zinc-100">
                                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 text-center">
                                        Day {(selectedDayOffsets[0] || 0) + 1}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                            <div className="text-zinc-400 mb-1"><MapPin size={14} /></div>
                                            <div className="text-sm font-bold text-zinc-900">{stats.destinations}</div>
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Places</div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                            <div className="text-zinc-400 mb-1"><Clock size={14} /></div>
                                            <div className="text-sm font-bold text-zinc-900">{stats.totalTime}</div>
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Total</div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                            <div className="text-zinc-400 mb-1"><CarFront size={14} /></div>
                                            <div className="text-sm font-bold text-zinc-900">{stats.roadTime}</div>
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Road</div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                                            <div className="text-zinc-400 mb-1"><Hourglass size={14} /></div>
                                            <div className="text-sm font-bold text-zinc-900">{stats.spotTime}</div>
                                            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Spot</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls Group (Grey Background) */}
                                <div className="bg-zinc-50/80 border-t border-zinc-200">
                                    <div className="pt-4 pb-2">
                                        <CategoryFilter selected={category} onSelect={setCategory} />
                                    </div>

                                    {/* Date Selector */}
                                    <div className="flex gap-2 flex-wrap justify-start px-6 pb-5 overflow-x-auto no-scrollbar">
                                        {tripDates.map((dateObj, i) => {
                                            const isSelected = selectedDayOffsets.includes(dateObj.offset);
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => toggleDate(dateObj.offset)}
                                                    className={`
                                                    flex flex-col items-center justify-center min-w-[3rem] h-14 rounded-2xl transition-all duration-300 border
                                                    ${isSelected
                                                            ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-md shadow-blue-500/40 scale-105 z-10'
                                                            : 'bg-white text-zinc-500 border-zinc-200 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-700'}
                                                `}
                                                >
                                                    <span className={`text-base leading-none mb-0.5 ${isSelected ? 'font-bold' : 'font-bold text-zinc-700'}`}>{dateObj.dateNum}</span>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/90' : 'text-zinc-400'}`}>{dateObj.dayName}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>


                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Edit Controls Bar - Always Visible */}
                    <div className="px-6 py-3 w-full bg-zinc-50/95 backdrop-blur-xl border-t border-zinc-200">
                        <div className="grid grid-cols-3 gap-3 w-full">
                            <button
                                onClick={handleUpdateTraffic}
                                disabled={isUpdatingTraffic}
                                className={`
                                h-8 px-3 rounded-full border flex items-center justify-center gap-1.5 text-[10px] font-bold transition-all shadow-sm w-full
                                ${isUpdatingTraffic
                                        ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-wait'
                                        : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-900 active:scale-95'
                                    }
                            `}
                            >
                                <RefreshCcw size={10} className={isUpdatingTraffic ? 'animate-spin' : ''} />
                                {isUpdatingTraffic ? 'Updating...' : 'Update Traffic'}
                            </button>

                            <button
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className={`
                                h-8 px-3 rounded-full flex items-center justify-center gap-1.5 text-[10px] font-bold transition-all w-full
                                ${isOptimizing
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 cursor-wait'
                                        : 'bg-[#007AFF] text-white shadow-md shadow-blue-500/30 hover:bg-blue-600 hover:scale-105 active:scale-95'
                                    }
                            `}
                            >
                                <Sparkles size={10} className={isOptimizing ? 'animate-spin' : ''} />
                                {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
                            </button>

                            <button
                                onClick={handleToggleEdit}
                                className={`h-8 px-3 rounded-full border flex items-center justify-center gap-1.5 text-[10px] font-bold transition-all shadow-sm w-full
                                ${isEditing
                                        ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
                                        : 'bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400'}
                            `}
                            >
                                {isEditing ? <Check size={12} /> : <Pencil size={10} />}
                                {isEditing ? 'Done' : 'Edit'}
                            </button>
                        </div>
                    </div>
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
                                <Reorder.Item
                                    key={event.id}
                                    value={event}
                                    dragListener={isEditing}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative"
                                    style={{ touchAction: isEditing ? 'none' : 'auto' }}
                                >

                                    {/* Insert Zone BEFORE item */}
                                    {isEditing && (
                                        <div
                                            onClick={() => openSelectorAt(index)}
                                            className="h-10 my-2 flex items-center justify-center group cursor-pointer transition-all"
                                        >
                                            <div className="h-[2px] w-full bg-zinc-200 group-hover:bg-zinc-300 rounded-full relative transition-all">
                                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-900 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg scale-100 transition-transform flex items-center gap-1">
                                                    <Plus size={10} strokeWidth={3} /> INSERT HERE
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="relative group" onClick={() => isEditing && openEditModal(event)}>
                                        <TimelineItem
                                            event={event}
                                            isLast={index === filteredEvents.length - 1}
                                            isFirst={index === 0}
                                            isCompact={isEditing}
                                            icon={getIcon(event.type)}
                                            nextCongestion={filteredEvents[index + 1]?.congestion}
                                            onCheckIn={handleCheckIn}
                                            onSkip={handleSkip}
                                            onTimeChange={handleTimeChange}
                                            onBufferChange={handleBufferChange}
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
                                </Reorder.Item>
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
                )}

                {/* Final Insert Zone at the end */}
                {isEditing && filteredEvents.length > 0 && (
                    <div
                        onClick={() => openSelectorAt(filteredEvents.length)}
                        className="h-12 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-sm font-bold text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 cursor-pointer transition-all mt-4"
                    >
                        + Add to End
                    </div>
                )}
            </div>
        </Layout>
    );
}
