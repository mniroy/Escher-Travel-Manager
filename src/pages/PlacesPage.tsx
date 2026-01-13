import { Layout } from '../components/Layout';
import { MapPin, Search, Star, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState, useEffect, useRef } from 'react';
import { uuidv4 } from '../lib/uuid';
import { Link } from 'react-router-dom';
import { Category, CategoryFilter } from '../components/CategoryFilter';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { AddActivityModal, NewActivity } from '../components/AddActivityModal';
import { TimelineEvent } from '../components/TimelineItem';

export default function PlacesPage() {
    const { events, setEvents, deleteEvent } = useTrip(); // Need deleteEvent
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<Category>('All');
    const [bgImage, setBgImage] = useState<string>('https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const { scrollY } = useScroll();
    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    // Dynamic Header Image Cycle
    useEffect(() => {
        const images = events
            .filter(e => e.image)
            .map(e => e.image as string);

        if (images.length > 0) {
            setBgImage(images[0]);

            if (images.length > 1) {
                let i = 0;
                const interval = setInterval(() => {
                    i = (i + 1) % images.length;
                    setBgImage(images[i]);
                }, 5000);
                return () => clearInterval(interval);
            }
        }
    }, [events]);

    const handleSavePlace = (activity: NewActivity) => {
        // Prevent Adding Duplicates
        // We consider it a duplicate if placeId matches, OR if googleMapsLink matches
        // (We don't match just by title because user might add generic 'Lunch')
        const isDuplicate = events.some(e => {
            if (activity.placeId && e.placeId === activity.placeId) return true;
            if (activity.googleMapsLink && e.googleMapsLink && e.googleMapsLink === activity.googleMapsLink) return true;
            // Also check title if it looks like a specific place name (optional, but requested "not able to add 2 same places")
            // For now, ID and Link are the strongest signals.
            return false;
        });

        if (isDuplicate) {
            alert('This place is already in your list!');
            return false; // Prevent Modal Close
        }

        const newEvent: TimelineEvent = {
            id: uuidv4(),
            type: activity.type,
            title: activity.title,
            time: '', // No time for saved places
            description: activity.description,
            rating: activity.rating,
            reviews: activity.reviews,
            image: activity.image,
            googleMapsLink: activity.googleMapsLink,
            duration: activity.duration,
            status: 'Saved', // Mark as Saved
            dayOffset: -1, // Mark as Unscheduled
            placeId: activity.placeId // Ensure placeId is saved
        };

        setEvents(prev => [...prev, newEvent]);
        setIsAddModalOpen(false);
    };

    // Filter "Places" (Events that are locations) and deduplicate
    const uniquePlacesMap = new Map<string, TimelineEvent>();

    events
        .filter(e => ['Stay', 'Eat', 'Play'].includes(e.type) && e.status === 'Saved')
        .forEach(e => {
            // Create a unique key for the place
            // prioritization: placeId > googleMapsLink > title
            const key = e.placeId || e.googleMapsLink || e.title;
            if (key && !uniquePlacesMap.has(key)) {
                uniquePlacesMap.set(key, e);
            }
        });

    const filteredPlaces = Array.from(uniquePlacesMap.values())
        .filter(e => {
            if (selectedCategory !== 'All' && e.type !== selectedCategory) return false;

            const query = searchQuery.toLowerCase();
            return (
                e.title.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query)
            );
        });

    const [displayLimit, setDisplayLimit] = useState(20);
    const loaderRef = useRef(null);

    // Reset pagination when filters change
    useEffect(() => {
        setDisplayLimit(20);
    }, [searchQuery, selectedCategory]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const target = entries[0];
            if (target.isIntersecting && displayLimit < filteredPlaces.length) {
                setDisplayLimit(prev => Math.min(prev + 20, filteredPlaces.length));
            }
        }, {
            root: null,
            rootMargin: '100px',
            threshold: 1.0,
        });

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [filteredPlaces.length, displayLimit]);

    const visiblePlaces = filteredPlaces.slice(0, displayLimit);

    return (
        <Layout>
            <div className="min-h-screen bg-zinc-50 pb-24">

                {/* Parallax Header - Smaller to match Itinerary */}
                <div className="h-[280px] w-full fixed top-0 left-0 right-0 z-0 overflow-hidden bg-zinc-900">
                    <AnimatePresence mode="popLayout">
                        <motion.img
                            key={bgImage}
                            src={bgImage}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5 }}
                            style={{ y: bgY, opacity: bgOpacity }}
                            className="absolute inset-0 w-full h-full object-cover"
                            alt="Header Background"
                        />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-[#0B1221]/40 z-10 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10 pointer-events-none h-full translate-y-1" />

                    <div className="absolute bottom-16 left-6 z-20">
                        <h1 className="text-4xl font-['Playfair_Display'] font-black text-white mb-2 shadow-sm drop-shadow-md">Destination Library</h1>
                        <p className="text-white/90 text-sm font-medium drop-shadow-sm max-w-xs">Your personal collection of saved places.</p>
                    </div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 mt-[260px]">
                    <div className="bg-zinc-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-screen pt-2">

                        {/* Search & Filter Sticky Header */}
                        <div className="sticky top-0 z-40 bg-zinc-50/95 backdrop-blur-md pt-6 pb-4 px-6 rounded-t-[2.5rem] border-b border-zinc-100">
                            <div className="space-y-4">
                                {/* Explore Banner */}
                                <Link
                                    to="/places/explore"
                                    className="block bg-gradient-to-r from-[#007AFF] to-blue-600 p-4 rounded-3xl text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg">Explore Recommendations</h3>
                                            </div>
                                            <p className="text-blue-100 text-xs font-medium">Find new gems to add to your library</p>
                                        </div>
                                        <div className="bg-white/20 w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                            <ArrowRight size={20} />
                                        </div>
                                    </div>
                                </Link>

                                <div className="flex gap-2">
                                    <div className="relative shadow-lg shadow-zinc-200/50 rounded-2xl flex-grow">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search your library..."
                                            className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-12 pr-4 text-zinc-900 focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-100 placeholder:text-zinc-400 font-medium transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="bg-white border border-zinc-200 px-4 rounded-2xl flex items-center justify-center gap-2 text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition-all font-bold text-sm min-w-fit"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                <div>
                                    <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-24">
                            {filteredPlaces.length > 0 ? (
                                <div className="grid gap-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {visiblePlaces.map(place => (
                                        <Link
                                            to={`/place/${place.id}`}
                                            key={place.id}
                                            className="block group"
                                        >
                                            <div className="bg-white rounded-[1.75rem] overflow-hidden shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all border border-zinc-100 hover:scale-[1.01] active:scale-[0.99]">
                                                <div className="h-40 bg-zinc-100 relative overflow-hidden">
                                                    {place.image ? (
                                                        <img
                                                            src={place.image}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            alt={place.title}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-300">
                                                            <MapPin size={40} />
                                                        </div>
                                                    )}

                                                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />

                                                    {/* Type Badge (Category Label - Left Now) */}
                                                    <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/10 shadow-sm z-20">
                                                        {place.type}
                                                    </div>

                                                    {/* Delete Button (Corner Peel - Right Now) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (window.confirm('Are you sure you want to delete this place?')) {
                                                                deleteEvent(place.id);
                                                            }
                                                        }}
                                                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20 shadow-sm z-20 hover:bg-red-500/80 transition-all active:scale-95"
                                                        title="Delete from library"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="p-5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-lg font-bold text-zinc-900 leading-tight group-hover:text-[#007AFF] transition-colors line-clamp-1">{place.title}</h3>
                                                        <div className="flex items-center gap-1 bg-yellow-400/10 px-1.5 py-0.5 rounded text-yellow-600 font-bold text-xs">
                                                            <Star size={10} fill="currentColor" />
                                                            <span>{place.rating || 'New'}</span>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4 font-medium leading-relaxed">{place.description}</p>

                                                    <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
                                                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md">
                                                            {place.reviews ? `${place.reviews} reviews` : 'No reviews'}
                                                        </span>
                                                        <span className="text-xs text-[#007AFF] font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                                                            View Details <ArrowRight size={14} />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                    {displayLimit < filteredPlaces.length && (
                                        <div ref={loaderRef} className="h-10 w-full flex items-center justify-center opacity-50">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]"></div>
                                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]"></div>
                                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-60">
                                    <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-2">
                                        <MapPin className="text-zinc-300" size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-400">
                                            {searchQuery ? 'No matches found' : 'No places yet'}
                                        </h3>
                                        <p className="text-zinc-400 text-sm max-w-[200px] mx-auto mt-1">
                                            {searchQuery
                                                ? 'Try adjusting your search terms.'
                                                : 'Add activities to see them here.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AddActivityModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSavePlace}
                hideDuration={true}
            />
        </Layout>
    );
}
