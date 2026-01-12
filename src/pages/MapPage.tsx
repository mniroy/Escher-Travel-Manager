import { Layout } from '../components/Layout';
import { Car, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState, useMemo } from 'react';
import { MapComponent } from '../components/MapComponent';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapPage() {
    const { tripDates, events } = useTrip();
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);
    const [isRouteCardExpanded, setIsRouteCardExpanded] = useState(true);

    const selectedDate = tripDates.find(d => d.offset === selectedDayOffset) || tripDates[0];

    // Filter events for the selected day and sort by time
    // We treat 'TBD' times as last
    const dayEvents = useMemo(() => {
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
        const validEvents = dayEvents.filter(e => {
            if (e.lat && e.lng) return true;
            return false;
        });

        const points = validEvents.map(e => {
            let lat = e.lat;
            let lng = e.lng;

            return {
                id: e.id,
                lat: lat!,
                lng: lng!,
                title: e.title,
                label: (getDayEventIndex(dayEvents, e.id) + 1).toString(),
                color: e.type === 'Eat' ? '#F59E0B' : e.type === 'Stay' ? '#8B5CF6' : '#007AFF',
                congestion: e.congestion // Pass traffic status
            };
        }).filter(p => p.lat && p.lng);

        const center = points.length > 0
            ? { lat: points[0].lat, lng: points[0].lng }
            : { lat: -8.409518, lng: 115.188919 }; // Bali Default

        return {
            markers: points,
            mapCenter: center
        };
    }, [dayEvents]);

    const totalDistance = dayEvents.reduce((acc, curr) => {
        if (curr.travelDistance) {
            const val = parseFloat(curr.travelDistance.replace(' KM', ''));
            return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
    }, 0);

    const totalTravelTime = dayEvents.reduce((acc, curr) => {
        if (curr.travelTime) {
            const parts = curr.travelTime.split(' ');
            let min = 0;
            parts.forEach(p => {
                if (p.endsWith('h')) min += parseInt(p) * 60;
                if (p.endsWith('m')) min += parseInt(p);
            });
            return acc + min;
        }
        return acc;
    }, 0);

    return (
        <Layout fullScreen>
            <div className="relative h-full w-full max-w-[100vw] overflow-hidden overscroll-none bg-zinc-50 touch-pan-x touch-pan-y">

                <MapComponent
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                    center={mapCenter}
                    zoom={12}
                    markers={markers}
                    className="w-full h-full"
                />

                {/* Controls Overlay */}
                <div className="absolute top-14 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                    <div className="pointer-events-auto bg-white/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-lg border border-zinc-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                            <MapPin size={16} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Viewing Day {selectedDate?.offset + 1}</p>
                            <p className="text-sm font-bold text-zinc-900 leading-none whitespace-nowrap">{selectedDate?.dayName}, {selectedDate?.dateNum}</p>
                        </div>
                    </div>

                    {/* Traffic button removed */}
                </div>

                {/* Floating Date & Route Container */}
                <div className="absolute bottom-24 left-4 right-4 z-20 flex flex-col gap-4 pointer-events-none">

                    {/* Route Card */}
                    {dayEvents.length > 0 && (
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
                                    <h3 className="text-zinc-900 font-bold text-lg flex items-center gap-2">
                                        Route
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium mt-1">
                                        <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">{dayEvents.length} stops</span>
                                        {totalDistance > 0 && <span>• {totalDistance.toFixed(1)} km</span>}
                                        {totalTravelTime > 0 && <span>• {Math.floor(totalTravelTime / 60)}h {totalTravelTime % 60}m</span>}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="text-right">
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Next</div>
                                        <div className="text-zinc-900 font-bold text-sm truncate max-w-[100px]">{dayEvents[0].title}</div>
                                    </div>
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
                                        // onTouchStart stopPropagation helps prevent the drag from bubbling to map if content scrolls to end?
                                        // Actually overscroll-contain is usually enough for modern browsers.
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
