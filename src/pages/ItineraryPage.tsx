import { Layout } from '../components/Layout';
import { useState, useEffect } from 'react';
import { Category, CategoryFilter } from '../components/CategoryFilter';
import { TimelineItem, TimelineEvent } from '../components/TimelineItem';
import { AddActivityModal, NewActivity } from '../components/AddActivityModal';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { Plus, Settings, Plane, Coffee, MapPin, Bed, Pencil, Check, X, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const [isControlsExpanded, setIsControlsExpanded] = useState(true);

    // Undo History State
    const [_history, setHistory] = useState<TimelineEvent[][]>([]);

    // Edit Mode State
    const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

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

    const handleOptimize = () => {
        setIsOptimizing(true);
        addToHistory(events);

        // Simulate calculation delay
        setTimeout(() => {
            const currentDayEvents = events.filter(e => selectedDayOffsets.includes(e.dayOffset || 0));
            const otherEvents = events.filter(e => !selectedDayOffsets.includes(e.dayOffset || 0));

            // Mock Optimization: Simple sort by type then re-assign Mock times
            // In a real app, this would call a routing API
            const optimizedDay = [...currentDayEvents].sort((a, b) => {
                // Mock logic: Put 'Eat' events at standard meal times if possible, else sort by ID as a shuffle substitute
                if (a.type === 'Eat' && b.type !== 'Eat') return -1;
                if (b.type === 'Eat' && a.type !== 'Eat') return 1;
                return Math.random() - 0.5;
            });

            // Re-assign times sequentially to simulate "Smart Scheduling"
            let currentTime = 9 * 60; // Start at 9:00 AM in minutes
            const newOptimizedDay = optimizedDay.map((e, index) => {
                const hour = Math.floor(currentTime / 60);
                const minute = currentTime % 60;
                const timeString = `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

                // Add mock duration (e.g. 1.5 hours) for next start time
                currentTime += 90;

                // Add mock travel time
                const travelTime = index < optimizedDay.length - 1 ? `${Math.floor(Math.random() * 20 + 10)}m` : undefined;

                return { ...e, time: timeString, travelTime };
            });

            setEvents([...otherEvents, ...newOptimizedDay]);
            setIsOptimizing(false);
        }, 1500);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Transport': return <Plane size={18} />;
            case 'Eat': return <Coffee size={18} />;
            case 'Stay': return <Bed size={18} />;
            default: return <MapPin size={18} />;
        }
    };

    // --- Time Utilities and Logic ---
    const parseTime = (timeStr: string): number => {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
        let h = Math.floor(minutes / 60);
        let m = Math.floor(minutes % 60);
        const period = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const parseDuration = (durStr?: string): number => {
        if (!durStr) return 0;
        let minutes = 0;
        const hMatch = durStr.match(/(\d+)h/);
        const mMatch = durStr.match(/(\d+)m/);
        if (hMatch) minutes += parseInt(hMatch[1]) * 60;
        if (mMatch) minutes += parseInt(mMatch[1]);
        return minutes;
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
        setSelectedDayOffsets(prev => {
            if (prev.includes(offset)) {
                // Don't allow unselecting the last date (always keep at least one)
                if (prev.length === 1) return prev;
                return prev.filter(d => d !== offset);
            } else {
                return [...prev, offset].sort((a, b) => a - b);
            }
        });
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
                id: crypto.randomUUID(),
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

    const openModalAt = (index: number) => {
        setInsertIndex(index);
        setEditingEvent(null); // Ensure we are not in edit mode
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
    const springScrollY = useSpring(scrollY, { stiffness: 100, damping: 30, restDelta: 0.001 });
    const bgY = useTransform(springScrollY, [0, 500], [0, 150]);
    const bgOpacity = useTransform(springScrollY, [0, 300], [1, 0.3]);

    useEffect(() => {
        if (validImages.length <= 1) return;
        const interval = setInterval(() => {
            setBgIndex(prev => (prev + 1) % validImages.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [validImages.length]);

    // Scroll-based Collapse Logic
    const [hasCollapsedOnScroll, setHasCollapsedOnScroll] = useState(false);
    useMotionValueEvent(scrollY, "change", (latest) => {
        const threshold = 100; // Pixel threshold to trigger collapse
        if (latest > threshold && !hasCollapsedOnScroll && isControlsExpanded) {
            setIsControlsExpanded(false);
            setHasCollapsedOnScroll(true);
        } else if (latest < threshold && hasCollapsedOnScroll) {
            // Reset the lock when back at top, but don't force expand (user choice)
            // or we could optional: setIsControlsExpanded(true); if we want auto-expand at top
            setHasCollapsedOnScroll(false);
        }
    });

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

            {/* Header Area */}
            <header className="relative z-10 min-h-[280px] flex flex-col justify-end p-6 overflow-hidden">
                {/* Background Image */}
                <motion.div
                    style={{ y: bgY, opacity: bgOpacity }}
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

                <div className="relative z-10 flex justify-between items-end pb-12">
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
            <div className="sticky top-0 z-30 transition-all -mt-6">
                {/* Collapse Toggle Tab */}
                <div className="flex justify-center relative z-20">
                    <button
                        onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                        className="bg-zinc-50/95 backdrop-blur-xl border-t border-x border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl w-16 h-6 flex items-center justify-center text-zinc-400 hover:text-[#007AFF] transition-all active:scale-95"
                    >
                        {isControlsExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
                    </button>
                </div>

                <div className="bg-zinc-50/95 backdrop-blur-xl border-b border-zinc-200 shadow-sm rounded-t-xl overflow-hidden mt-[-1px]">

                    <AnimatePresence>
                        {isControlsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="pb-2">
                                    <CategoryFilter selected={category} onSelect={setCategory} />
                                </div>

                                {/* Date Selector */}
                                <div className="flex gap-2 flex-wrap justify-center px-6 py-4 pb-5">
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

                                {/* Edit Controls Bar */}
                                <div className="px-6 py-3 flex justify-between items-center bg-zinc-50/50 backdrop-blur-md border-t border-zinc-200">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleOptimize}
                                            disabled={isOptimizing}
                                            className={`
                                            h-8 px-3 rounded-full flex items-center gap-1.5 text-[10px] font-bold transition-all
                                            ${isOptimizing
                                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 cursor-wait'
                                                    : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-500 hover:scale-105 active:scale-95'
                                                }
                                        `}
                                        >
                                            <Sparkles size={10} className={isOptimizing ? 'animate-spin' : ''} />
                                            {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
                                        </button>

                                        <button
                                            onClick={() => setIsEditing(!isEditing)}
                                            className={`h-8 px-3 rounded-full border flex items-center gap-1.5 text-[10px] font-bold transition-all
                                            ${isEditing
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 shadow-sm'}
                                        `}
                                        >
                                            {isEditing ? <Check size={12} /> : <Pencil size={10} />}
                                            {isEditing ? 'Done' : 'Edit'}
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                        {filteredEvents.length} Items
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className={`px-6 pb-24 pt-6 space-y-2 min-h-[50vh] transition-all ${isEditing ? 'px-8' : 'px-6'}`}>
                <AnimatePresence mode='popLayout'>
                    {filteredEvents.length > 0 ? (
                        filteredEvents.map((event, index) => (
                            <motion.div
                                layout
                                key={event.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >

                                {/* Insert Zone BEFORE item */}
                                {isEditing && (
                                    <div
                                        onClick={() => openModalAt(index)}
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
                                        icon={getIcon(event.type)}
                                        // onClick={() => isEditing && openEditModal(event)} // Removed duplicate onClick
                                        onCheckIn={handleCheckIn}
                                        onSkip={handleSkip}
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
                            </motion.div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800">
                                <MapPin size={24} className="opacity-50 text-zinc-500" />
                            </div>
                            <button
                                onClick={() => openModalAt(0)}
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
                            onClick={() => openModalAt(filteredEvents.length)}
                            className="h-12 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-sm font-bold text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 cursor-pointer transition-all mt-4"
                        >
                            + Add to End
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
}
