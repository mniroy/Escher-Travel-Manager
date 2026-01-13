import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useTrip } from '../context/TripContext';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Clock, Layers, Briefcase, Coffee, Hotel, TrendingUp } from 'lucide-react';

export default function TripSummaryPage() {
    const { tripName, startDate, tripDuration, events, tripDates } = useTrip();

    const { scrollY } = useScroll();
    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    // Background Image Cycling
    const validImages = events.map(e => e.image).filter((img): img is string => !!img);
    const [bgIndex, setBgIndex] = useState(0);

    useEffect(() => {
        if (validImages.length <= 1) return;
        const interval = setInterval(() => {
            setBgIndex(prev => (prev + 1) % validImages.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [validImages.length]);

    // Calculate Real Stats
    const totalEvents = events.length;

    // Count unique places (based on title or placeId if available)
    const uniquePlaces = new Set(events.filter(e => e.type !== 'Transport').map(e => e.title)).size;

    // Helper to parse distance string (e.g. "5.2 km", "500 m", "1,200 km")
    const parseDistance = (distStr?: string) => {
        if (!distStr) return 0;
        // Match number part which may contain commas or dots
        const match = distStr.toLowerCase().match(/([\d,.]+)\s*(km|m)/);
        if (!match) return 0;
        // Remove commas before parsing float
        const cleanNum = match[1].replace(/,/g, '');
        const val = parseFloat(cleanNum);
        if (isNaN(val)) return 0;
        return match[2] === 'm' ? val / 1000 : val;
    };

    const totalDistance = events.reduce((acc, e) => acc + parseDistance(e.travelDistance), 0).toFixed(1);

    // Breakdown
    const transportCount = events.filter(e => e.type === 'Transport').length;
    const accommodationCount = events.filter(e => e.type === 'Stay').length;
    const activityCount = events.filter(e => e.type === 'Play' || e.type === 'Eat').length;

    // Find busiest day
    const eventsPerDay = events.reduce((acc, curr) => {
        const day = curr.dayOffset || 0;
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    const maxEvents = Math.max(...Object.values(eventsPerDay), 0);
    const busiestDayIndex = Object.keys(eventsPerDay).find(day => eventsPerDay[Number(day)] === maxEvents);
    const busiestDayDate = busiestDayIndex !== undefined ? (tripDates[Number(busiestDayIndex)]?.fullDate || `Day ${Number(busiestDayIndex) + 1}`) : 'N/A';

    // Upcoming
    const now = new Date();
    const upcomingEvents = events
        .filter(e => new Date(e.time) > now)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .slice(0, 3);

    const nextEvent = upcomingEvents[0];

    const formatDateRange = (start: Date, duration: number) => {
        const end = new Date(start);
        end.setDate(end.getDate() + duration);
        return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    return (
        <Layout>
            <div className="min-h-screen bg-transparent pb-24">
                {/* Parallax Header */}
                <div className="h-[320px] w-full fixed top-0 left-0 right-0 z-0 overflow-hidden bg-zinc-900">
                    <motion.div style={{ y: bgY, opacity: bgOpacity }} className="absolute inset-0">
                        <AnimatePresence mode="popLayout">
                            {validImages.length > 0 ? (
                                <motion.img
                                    key={validImages[bgIndex]}
                                    src={validImages[bgIndex]}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.5 }}
                                    className="w-full h-full object-cover opacity-60"
                                    alt="Trip Highlight"
                                />
                            ) : (
                                <motion.img
                                    key="default-bali"
                                    src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.5 }}
                                    className="w-full h-full object-cover opacity-60"
                                    alt="Bali Jungle"
                                />
                            )}
                        </AnimatePresence>
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                    </motion.div>

                    <div className="absolute bottom-24 left-6 right-6 z-20 flex justify-between items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-[80%]"
                        >
                            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[10px] font-bold uppercase tracking-widest mb-3 inline-block">
                                Trip Overview
                            </span>
                            <h1 className="text-4xl font-['Playfair_Display'] font-black text-white mb-2 shadow-sm drop-shadow-md leading-tight">
                                {tripName}
                            </h1>
                            <p className="text-white/80 text-sm font-medium drop-shadow-sm flex items-center gap-2">
                                <Calendar size={14} />
                                {formatDateRange(startDate, tripDuration)}
                            </p>
                        </motion.div>
                    </div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 mt-[280px]">
                    <div className="bg-zinc-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-screen p-6 space-y-6">

                        {/* Highlights Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                                    <MapPin size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-2xl font-black text-zinc-900">{uniquePlaces}</div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Places to Visit</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-3">
                                    <Clock size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-2xl font-black text-zinc-900">{tripDuration}</div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Days Long</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
                                    <TrendingUp size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-2xl font-black text-zinc-900">{totalDistance}<span className="text-sm text-zinc-400 font-bold ml-1">km</span></div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Total Travel</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3">
                                    <Hotel size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-2xl font-black text-zinc-900">{accommodationCount}</div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Stays</div>
                            </motion.div>
                        </div>

                        {/* Trip Composition */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                            className="bg-zinc-900 p-6 rounded-3xl text-white relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                            <h3 className="text-lg font-bold font-['Playfair_Display'] mb-6 relative z-10">Trip Makeup</h3>

                            <div className="space-y-5 relative z-10">
                                <div>
                                    <div className="flex justify-between text-xs font-medium mb-2 text-zinc-300">
                                        <span className="flex items-center gap-2"><Coffee size={12} /> Activities & Food</span>
                                        <span>{activityCount}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(activityCount / (totalEvents || 1)) * 100}%` }}
                                            transition={{ duration: 1, delay: 0.6 }}
                                            className="h-full bg-emerald-500 rounded-full"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-medium mb-2 text-zinc-300">
                                        <span className="flex items-center gap-2"><Briefcase size={12} /> Transport</span>
                                        <span>{transportCount}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(transportCount / (totalEvents || 1)) * 100}%` }}
                                            transition={{ duration: 1, delay: 0.7 }}
                                            className="h-full bg-blue-500 rounded-full"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-medium mb-2 text-zinc-300">
                                        <span className="flex items-center gap-2"><Hotel size={12} /> Stays</span>
                                        <span>{accommodationCount}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(accommodationCount / (totalEvents || 1)) * 100}%` }}
                                            transition={{ duration: 1, delay: 0.8 }}
                                            className="h-full bg-purple-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center relative z-10">
                                <span className="text-xs text-zinc-400 font-medium">Busiest Day</span>
                                <span className="text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full">{busiestDayDate}</span>
                            </div>
                        </motion.div>

                        {/* Next Up */}
                        <div className="space-y-4">
                            <h3 className="text-zinc-900 text-lg font-bold font-['Playfair_Display']">Up Next</h3>

                            {nextEvent ? (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-4 border-l-4 border-l-blue-500"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">{nextEvent.type}</div>
                                        <h4 className="font-bold text-zinc-900 truncate text-lg">{nextEvent.title}</h4>
                                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                            <Clock size={12} /> {new Date(nextEvent.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {nextEvent.address && ` • ${nextEvent.address}`}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="text-center py-8 bg-white rounded-2xl border border-zinc-100 border-dashed">
                                    <p className="text-zinc-400 text-sm font-medium">No upcoming events!</p>
                                </div>
                            )}

                            {upcomingEvents.slice(1).map(event => (
                                <div key={event.id} className="bg-white p-4 rounded-xl border border-zinc-100 flex items-center justify-between opacity-80">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Layers size={14} className="text-zinc-400" />
                                        <span className="font-medium text-zinc-700 text-sm truncate">{event.title}</span>
                                    </div>
                                    <span className="text-xs text-zinc-400 whitespace-nowrap">{new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );
}
