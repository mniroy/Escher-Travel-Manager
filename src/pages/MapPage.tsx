import { Layout } from '../components/Layout';
import { MapPin, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState, useMemo, useEffect } from 'react';
import { MapComponent } from '../components/MapComponent';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapPage() {
    const { tripDates, events } = useTrip();
    const [selectedDayOffset, setSelectedDayOffset] = useState(-1);
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
    const [isRouteCardExpanded, setIsRouteCardExpanded] = useState(true);
    const [liveDistance, setLiveDistance] = useState<number | null>(null);
    const [liveDuration, setLiveDuration] = useState<number | null>(null);

    // Reset live data and selection when changing days
    useEffect(() => {
        setLiveDistance(null);
        setLiveDuration(null);
        setSelectedPlaceId(null);
    }, [selectedDayOffset]);

    const selectedDate = tripDates.find(d => d.offset === selectedDayOffset);

    const selectedEvent = useMemo(() => {
        return events.find(e => e.id === selectedPlaceId);
    }, [events, selectedPlaceId]);

    const scheduledInfo = useMemo(() => {
        if (!selectedEvent) return null;
        // 1. If the clicked event itself is scheduled
        if ((selectedEvent.dayOffset ?? -1) >= 0) {
            const date = tripDates.find(d => d.offset === selectedEvent.dayOffset);
            return {
                isScheduled: true,
                text: `Scheduled on Day ${date ? date.offset + 1 : '?'} (${date?.dayName})`
            };
        }
        // 2. If it's a saved place, check if it's scheduled elsewhere
        const scheduledVar = events.find(e =>
            (e.dayOffset ?? -1) >= 0 &&
            ((e.placeId && e.placeId === selectedEvent.placeId) ||
                (e.title === selectedEvent.title))
        );

        if (scheduledVar) {
            const date = tripDates.find(d => d.offset === scheduledVar.dayOffset);
            return {
                isScheduled: true,
                text: `Scheduled on Day ${date ? date.offset + 1 : '?'} (${date?.dayName})`
            };
        }

        return {
            isScheduled: false,
            text: "Saved in Library"
        };
    }, [selectedEvent, events, tripDates]);

    // Filter events for the selected day and sort by time
    // We treat 'TBD' times as last
    const dayEvents = useMemo(() => {
        if (selectedDayOffset === -1) return [];

        return events
            .filter(e => e.dayOffset === selectedDayOffset)
            .sort((a, b) => {
                const timeA = parseTime(a.time);
                const timeB = parseTime(b.time);
                return timeA - timeB;
            });
    }, [events, selectedDayOffset]);

    // Prepare Map Data
    const { markers, mapCenter } = useMemo(() => {
        // 1. Current Day Route Markers (Numbered)
        const dayMarkers = dayEvents
            .filter(e => e.lat && e.lng)
            .map(e => ({
                id: e.id,
                lat: e.lat!,
                lng: e.lng!,
                title: e.title,
                label: (getDayEventIndex(dayEvents, e.id) + 1).toString(),
                color: '#007AFF', // Route is always Blue default, or customize
                isRoutePoint: true
            }));

        // 2. POI Markers 
        // If All view (-1): Show ALL saved places
        // If Day view (>=0): Show NO extra POIs (only route)

        let poiMarkers: any[] = [];

        if (selectedDayOffset === -1) {
            const getTypeColor = (type: string) => {
                switch (type) {
                    case 'Transport': return '#3B82F6';
                    case 'Stay': return '#8B5CF6';
                    case 'Eat': return '#F97316';
                    case 'Play': return '#10B981';
                    default: return '#9CA3AF';
                }
            };

            const currentDayIds = new Set(dayEvents.map(e => e.id));

            poiMarkers = events
                .filter(e =>
                    e.status === 'Saved' &&
                    !currentDayIds.has(e.id) &&
                    e.lat && e.lng
                )
                .map(e => ({
                    id: e.id,
                    lat: e.lat!,
                    lng: e.lng!,
                    title: e.title,
                    label: '', // No number for POIs
                    type: e.type as 'Transport' | 'Stay' | 'Eat' | 'Play',
                    color: getTypeColor(e.type),
                    isRoutePoint: false
                }));
        }

        const allMarkers = [...dayMarkers, ...poiMarkers];

        // Center on the first event of the day, or first POI, or Bali default
        let center = { lat: -8.409518, lng: 115.188919 };
        if (dayMarkers.length > 0) {
            center = { lat: dayMarkers[0].lat, lng: dayMarkers[0].lng };
        } else if (poiMarkers.length > 0) {
            center = { lat: poiMarkers[0].lat, lng: poiMarkers[0].lng };
        }

        return {
            markers: allMarkers,
            mapCenter: center
        };
    }, [dayEvents, events, selectedDayOffset]);

    const totalDistance = dayEvents.reduce((acc, curr) => {
        if (curr.travelDistance) {
            // Extract the number part from "5.2 km", "3 KM", etc.
            const match = curr.travelDistance.match(/([\d.]+)/);
            const val = match ? parseFloat(match[1]) : 0;
            return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
    }, 0);

    const totalTravelTime = dayEvents.reduce((acc, curr) => {
        if (curr.travelTime) {
            // Flexible parsing for "1h 30m", "45m", "2h", etc.
            const hoursMatch = curr.travelTime.match(/(\d+)\s*h/i);
            const minsMatch = curr.travelTime.match(/(\d+)\s*m/i);

            let min = 0;
            if (hoursMatch) min += parseInt(hoursMatch[1]) * 60;
            if (minsMatch) min += parseInt(minsMatch[1]);

            return acc + min;
        }
        return acc;
    }, 0);

    const displayDistance = liveDistance !== null ? liveDistance : totalDistance;
    const displayDuration = liveDuration !== null ? liveDuration : totalTravelTime;

    return (
        <Layout fullScreen>
            <div className="relative h-full w-full max-w-[100vw] overflow-hidden overscroll-none bg-zinc-50 touch-pan-x touch-pan-y">

                <MapComponent
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                    center={mapCenter}
                    zoom={12}
                    markers={markers}
                    className="w-full h-full"
                    onRouteInfo={(dist, dur) => {
                        setLiveDistance(dist);
                        setLiveDuration(dur);
                    }}
                    onMarkerClick={setSelectedPlaceId}
                    onMapClick={() => setSelectedPlaceId(null)}
                />

                {/* Controls Overlay */}
                <div className="absolute top-14 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                    <div className="pointer-events-auto bg-white/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-lg border border-zinc-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                            <MapPin size={16} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                {selectedDayOffset === -1 ? 'VIEWING' : `Viewing Day ${selectedDate?.offset! + 1}`}
                            </p>
                            <p className="text-sm font-bold text-zinc-900 leading-none whitespace-nowrap">
                                {selectedDayOffset === -1 ? 'All Places' : `${selectedDate?.dayName}, ${selectedDate?.dateNum}`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Floating Date & Route Container */}
                <div className="absolute bottom-24 left-4 right-4 z-20 flex flex-col gap-4 pointer-events-none">

                    {/* DETAIL CARD (Overlay) */}
                    <AnimatePresence>
                        {selectedEvent && scheduledInfo && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white/95 backdrop-blur-xl rounded-2xl border border-zinc-100 shadow-[0_8px_30px_rgba(0,0,0,0.12)] pointer-events-auto p-4 relative z-30"
                            >
                                <div className="flex justify-between items-start gap-4 mb-1">
                                    <div className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white bg-zinc-400"
                                        style={{
                                            backgroundColor:
                                                selectedEvent.type === 'Eat' ? '#F97316' :
                                                    selectedEvent.type === 'Stay' ? '#8B5CF6' :
                                                        selectedEvent.type === 'Transport' ? '#3B82F6' :
                                                            selectedEvent.type === 'Play' ? '#10B981' : '#9CA3AF'
                                        }}
                                    >
                                        {selectedEvent.type}
                                    </div>
                                    <button
                                        onClick={() => setSelectedPlaceId(null)}
                                        className="text-zinc-400 hover:text-zinc-600 -mt-1 -mr-1 p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <h3 className="text-base font-bold text-zinc-900 leading-tight mb-1.5">{selectedEvent.title}</h3>

                                <div className={`flex items-center gap-2 text-xs ${scheduledInfo.isScheduled ? 'text-blue-600' : 'text-zinc-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${scheduledInfo.isScheduled ? 'bg-blue-500' : 'bg-zinc-300'}`} />
                                    <span className="font-medium">{scheduledInfo.text}</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Route Card (Only show if no detail selected) */}
                    {!selectedPlaceId && dayEvents.length > 0 && (
                        <motion.div
                            initial={false}
                            animate={{ height: isRouteCardExpanded ? 'auto' : 'auto' }}
                            className="bg-white/95 backdrop-blur-xl rounded-[1.75rem] border border-zinc-100 shadow-[0_8px_30px_rgba(0,0,0,0.12)] pointer-events-auto flex flex-col overflow-hidden"
                        >
                            {/* Header (Always Visible) - Click to toggle */}
                            <div
                                onClick={() => setIsRouteCardExpanded(!isRouteCardExpanded)}
                                className="p-5 flex justify-between items-start flex-shrink-0 cursor-pointer active:bg-zinc-50 transition-colors touch-none"
                            >
                                <div>
                                    <h3 className="text-zinc-900 font-bold text-lg flex items-center flex-wrap gap-x-2">
                                        Route
                                        {displayDuration > 0 && <span className="text-zinc-400 font-medium">•</span>}
                                        {displayDuration > 0 && <span className="text-sm text-zinc-600">{Math.floor(displayDuration / 60)}h {displayDuration % 60}m</span>}
                                        {displayDistance > 0 && <span className="text-zinc-400 font-medium">•</span>}
                                        {displayDistance > 0 && <span className="text-sm text-zinc-600">{displayDistance.toFixed(1)} km</span>}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium mt-1">
                                        <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">{dayEvents.length} stops</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400">
                                        {isRouteCardExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                    </div>
                                </div>
                            </div>

                            {/* List Content (Collapsible) */}
                            <AnimatePresence initial={false}>
                                {isRouteCardExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        className="border-t border-zinc-100"
                                    >
                                        <div
                                            className="overflow-y-auto custom-scrollbar max-h-[35vh] overscroll-contain touch-pan-y p-5 pt-2"
                                            onTouchStart={(e) => e.stopPropagation()}
                                        >
                                            <div className="relative -mx-2 px-2">
                                                {dayEvents.length > 1 && (
                                                    <div className="absolute top-4 bottom-4 left-[23px] w-[2px] bg-zinc-100" />
                                                )}

                                                {dayEvents.map((event, index) => (
                                                    <RouteStop
                                                        key={event.id}
                                                        title={event.title}
                                                        time={event.time}
                                                        active={index === 0}
                                                        last={index === dayEvents.length - 1}
                                                        type={event.type}
                                                        travelTime={event.travelTime}
                                                        congestion={event.congestion}
                                                        index={index + 1}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* Date Selector Pill */}
                    <div className="pointer-events-auto bg-white/90 backdrop-blur-xl p-1.5 rounded-[1.25rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-zinc-100 flex gap-2 overflow-x-auto no-scrollbar mx-auto max-w-full overscroll-contain touch-pan-x">
                        <button
                            onClick={() => setSelectedDayOffset(-1)}
                            className={`
                                flex flex-col items-center justify-center min-w-[3.25rem] h-14 rounded-2xl transition-all duration-200
                                ${selectedDayOffset === -1
                                    ? 'bg-[#007AFF] text-white shadow-md shadow-blue-500/25 scale-100'
                                    : 'bg-transparent text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
                                }
                            `}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">VIEW</span>
                            <span className={`text-lg font-bold leading-none mt-0.5 ${selectedDayOffset === -1 ? 'text-white' : 'text-zinc-600'}`}>ALL</span>
                        </button>

                        <div className="w-px bg-zinc-200 my-2" />

                        {tripDates.map((dateItem) => (
                            <button
                                key={dateItem.offset}
                                onClick={() => setSelectedDayOffset(dateItem.offset)}
                                className={`
                                    flex flex-col items-center justify-center min-w-[3.25rem] h-14 rounded-2xl transition-all duration-200
                                    ${selectedDayOffset === dateItem.offset
                                        ? 'bg-[#007AFF] text-white shadow-md shadow-blue-500/25 scale-100'
                                        : 'bg-transparent text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
                                    }
                                `}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">{dateItem.dayName}</span>
                                <span className={`text-lg font-bold leading-none mt-0.5 ${selectedDayOffset === dateItem.offset ? 'text-white' : 'text-zinc-600'}`}>{dateItem.dateNum}</span>
                            </button>
                        ))}
                    </div>

                </div>
            </div>
        </Layout>
    );
}

function RouteStop({ title, time, active, last, travelTime, congestion, index }: { title: string; time: string; active?: boolean; last?: boolean; type?: string; travelTime?: string; congestion?: string; index: number }) {

    let trafficColor = 'text-zinc-400';
    if (congestion === 'high') trafficColor = 'text-red-500';
    else if (congestion === 'moderate') trafficColor = 'text-amber-500';
    else if (congestion === 'low') trafficColor = 'text-emerald-500';

    return (
        <div className={`flex items-start gap-4 relative z-10 ${!last ? 'pb-6' : ''}`}>

            <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition-colors relative z-10 font-bold text-[10px]
                ${active
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-zinc-100 text-zinc-400'
                }`}
            >
                {index}
            </div>

            <div className="min-w-0 pt-0.5">
                <p className={`text-sm font-bold truncate transition-colors ${active ? 'text-zinc-900' : 'text-zinc-500'}`}>{title}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded">{time || 'TBD'}</span>

                    {travelTime && (
                        <span className={`text-[10px] flex items-center gap-1 ${trafficColor} font-bold bg-white border border-zinc-100 px-1.5 py-0.5 rounded-full shadow-sm`}>
                            {travelTime}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

function parseTime(timeStr: string): number {
    if (!timeStr || timeStr === 'TBD') return 9999;
    try {
        const [time, period] = timeStr.split(' ');
        if (!time || !period) return 9999;

        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    } catch {
        return 9999;
    }
}

function getDayEventIndex(events: any[], id: string) {
    return events.findIndex(e => e.id === id);
}
