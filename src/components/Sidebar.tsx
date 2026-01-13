import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Map, Calendar, Settings } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState } from 'react';
import { TripSettingsModal } from './TripSettingsModal';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { trips, currentTripId, switchTrip, createNewTrip, tripName, startDate, tripDuration, setTripName, setStartDate, setTripDuration } = useTrip();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Active trip always on top
    const sortedTrips = [...trips].sort((a, b) => a.id === currentTripId ? -1 : b.id === currentTripId ? 1 : 0);

    // Close when clicking outside - simplified for now, mainly relies on overlay

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-[320px] bg-white text-zinc-900 z-[70] flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 p-24 bg-purple-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

                        {/* Header */}
                        <div className="p-8 pt-12 relative z-10">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100/50 rounded-full hover:bg-zinc-100"
                            >
                                <X size={20} />
                            </button>

                            <div className="mb-2">
                                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">Escher</span>
                            </div>
                            <h2 className="text-3xl font-['Playfair_Display'] font-black text-zinc-900 leading-tight">
                                Travel<br />Manager
                            </h2>
                        </div>

                        {/* Trip List */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 relative z-10">
                            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">Your Trips</div>

                            {sortedTrips.map(trip => {
                                const isActive = trip.id === currentTripId;
                                return (
                                    <div
                                        key={trip.id}
                                        onClick={() => {
                                            if (!isActive) {
                                                switchTrip(trip.id);
                                                onClose();
                                            }
                                        }}
                                        className={`group relative rounded-2xl transition-all cursor-pointer overflow-hidden ${isActive
                                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-900/30'
                                            : 'bg-zinc-100 border border-zinc-200 hover:bg-white hover:border-zinc-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-stretch h-full">
                                            {/* Left Content (3/4) */}
                                            <div className="flex-1 p-4 flex flex-col justify-between relative z-10">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isActive ? 'bg-white text-blue-600 shadow-lg' : 'bg-white text-zinc-400'
                                                        }`}>
                                                        <Map size={18} strokeWidth={2.5} />
                                                    </div>

                                                    {isActive && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setIsSettingsOpen(true);
                                                                }}
                                                                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors backdrop-blur-md"
                                                            >
                                                                <Settings size={12} />
                                                            </button>
                                                            <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 h-6 flex items-center">
                                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className={`font-bold text-lg mb-1 leading-tight line-clamp-1 ${isActive ? 'text-white' : 'text-zinc-900'}`}>
                                                        {trip.name}
                                                    </h3>

                                                    <div className={`flex items-center gap-2 text-[11px] font-medium ${isActive ? 'text-blue-100' : 'text-zinc-400'}`}>
                                                        <Calendar size={11} />
                                                        <span>
                                                            {new Date(trip.start_date).toLocaleDateString(undefined, { month: 'short' })}
                                                        </span>
                                                        <span className="w-1 h-1 bg-current rounded-full opacity-50" />
                                                        <span>{trip.duration}d</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Image (1/4) - Only for Active Trip */}
                                            {isActive && (
                                                <div className="w-1/4 min-w-[80px] relative h-auto">
                                                    <ActiveTripImage defaultImage={trip.cover_image} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-zinc-100 bg-white/80 backdrop-blur-xl relative z-20">
                            <button
                                onClick={async () => {
                                    await createNewTrip();
                                    setIsSettingsOpen(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] rounded-2xl font-black text-sm transition-all shadow-xl shadow-zinc-900/10"
                            >
                                <Plus size={20} strokeWidth={3} />
                                Create New Trip
                            </button>
                        </div>

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
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function ActiveTripImage({ defaultImage }: { defaultImage: string | null }) {
    const { events } = useTrip();
    const validImages = events.map(e => e.image).filter((img): img is string => !!img);

    // Use the first image found in events, or fallback
    const imgSrc = validImages.length > 0
        ? validImages[0]
        : (defaultImage || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80');

    return (
        <motion.img
            key={imgSrc}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            src={imgSrc}
            alt="Active Trip Slide"
            className="w-full h-full object-cover absolute inset-0"
        />
    );
}
