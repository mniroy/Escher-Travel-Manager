
import { Layout } from '../components/Layout';
import { Search, MapPin, Star, Plus, ArrowLeft, Loader2, DollarSign, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { uuidv4 } from '../lib/uuid';
import { TimelineEvent } from '../components/TimelineItem';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

// Types for our API response
interface GooglePlace {
    name: string;
    address: string;
    rating?: number;
    userRatingCount?: number;
    placeId: string;
    types?: string[];
    photos?: string[];
    openingHours?: string[];
    isOpen?: boolean;
    googleMapsUrl: string;
    reviews?: any[];
    location?: { latitude: number; longitude: number };
    websiteUri?: string;
    priceLevel?: string;
    editorialSummary?: string;
}

export default function ExplorePlacesPage() {
    const navigate = useNavigate();
    const { setEvents, events } = useTrip();

    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<GooglePlace[]>([]);
    const [error, setError] = useState('');
    const [bgImage, setBgImage] = useState<string>('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=80');

    // Scroll Effects
    const { scrollY } = useScroll();
    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    // Update BG image based on results
    useEffect(() => {
        if (results.length > 0 && results[0].photos && results[0].photos.length > 0) {
            setBgImage(results[0].photos[0]);
        }
    }, [results]);

    // Predefined chips for query augmentation
    const chips = ['Food', 'Nature', 'Playground', 'Cafe', 'Museum', 'Park', 'Shopping'];

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch('/api/explore-places', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch places');
            }

            if (data.places) {
                setResults(data.places);
            } else {
                setResults([]); // No results
            }
        } catch (err) {
            console.error(err);
            setError('Failed to search places. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPlace = (e: React.MouseEvent, place: GooglePlace) => {
        e.preventDefault();
        e.stopPropagation();

        // Check for duplicates
        const isDuplicate = events.some(ev => ev.placeId === place.placeId);
        if (isDuplicate) {
            alert('This place is already in your list!');
            return;
        }

        // Map Google Place to TimelineEvent
        let type: 'Eat' | 'Play' | 'Stay' | 'Transport' = 'Play';
        if (place.types) {
            if (place.types.includes('restaurant') || place.types.includes('food') || place.types.includes('cafe')) type = 'Eat';
            else if (place.types.includes('lodging') || place.types.includes('hotel')) type = 'Stay';
            else if (place.types.includes('transit_station') || place.types.includes('airport')) type = 'Transport';
        }

        const newEvent: TimelineEvent = {
            id: uuidv4(),
            type,
            title: place.name || 'Unknown Place',
            description: place.editorialSummary || place.address,
            rating: place.rating,
            reviews: place.userRatingCount,
            image: place.photos && place.photos.length > 0 ? place.photos[0] : undefined,
            placeId: place.placeId,
            googleMapsLink: place.googleMapsUrl,
            status: 'Saved',
            dayOffset: -1,
            time: '',
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            address: place.address,
            openingHours: place.openingHours
        };

        setEvents(prev => [...prev, newEvent]);
        alert(`Added ${place.name} to your library!`);
    };

    return (
        <Layout>
            <div className="relative min-h-screen bg-zinc-50 pb-24">

                {/* Parallax Header */}
                <div className="h-[45vh] w-full fixed top-0 left-0 right-0 z-0 overflow-hidden bg-zinc-900">
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

                    <div className="absolute bottom-24 left-6 z-20">
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => navigate('/places')}
                                className="p-1.5 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Discover</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-white mb-2 shadow-sm drop-shadow-md">Explore</h1>
                        <p className="text-white/90 text-sm font-medium drop-shadow-sm max-w-xs">
                            Find new gems to add to your itinerary.
                        </p>
                    </div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 mt-[42vh]">
                    <div className="bg-zinc-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-screen pt-2">

                        {/* Search & Filter Sticky Header */}
                        <div className="sticky top-0 z-40 bg-zinc-50/95 backdrop-blur-md pt-6 pb-4 px-6 rounded-t-[2.5rem] border-b border-zinc-100">

                            <form onSubmit={handleSearch} className="relative shadow-lg shadow-zinc-200/50 rounded-2xl mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search e.g. 'Best Ramen in Tokyo'"
                                    className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-12 pr-4 text-zinc-900 focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-100 placeholder:text-zinc-400 font-medium transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#007AFF] text-white px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-[#0061c2] disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
                                </button>
                            </form>

                            {/* Chips */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                                {chips.map(chip => (
                                    <button
                                        key={chip}
                                        onClick={() => setQuery(prev => prev ? `${prev} ${chip}` : chip)}
                                        className="px-4 py-1.5 rounded-full bg-white text-zinc-600 text-sm font-semibold border border-zinc-200 whitespace-nowrap hover:bg-zinc-50 active:scale-95 transition-all shadow-sm"
                                    >
                                        + {chip}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Results */}
                        <div className="px-6 pb-24 pt-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-4">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-5">
                                <AnimatePresence>
                                    {results.map((place) => (
                                        <motion.div
                                            key={place.placeId}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group relative"
                                        >
                                            <div className="bg-white rounded-[1.75rem] overflow-hidden shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all border border-zinc-100 hover:scale-[1.01] active:scale-[0.99]">
                                                {/* Image Area */}
                                                <div className="h-40 bg-zinc-100 relative overflow-hidden">
                                                    {place.photos && place.photos.length > 0 ? (
                                                        <img
                                                            src={place.photos[0]}
                                                            alt={place.name}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                                            <MapPin size={40} />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

                                                    {/* Helper Badges */}
                                                    <div className="absolute top-3 left-3 flex gap-2">
                                                        {place.isOpen !== undefined && (
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border border-white/20 shadow-sm ${place.isOpen ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                                                {place.isOpen ? 'Open Now' : 'Closed'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Add Button */}
                                                    <button
                                                        onClick={(e) => handleAddPlace(e, place)}
                                                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[#007AFF] text-white shadow-lg shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all z-20 border border-white/20"
                                                    >
                                                        <Plus size={16} strokeWidth={3} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="p-5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-lg font-bold text-zinc-900 leading-tight group-hover:text-[#007AFF] transition-colors pr-8 line-clamp-1">{place.name}</h3>
                                                        <div className="flex items-center gap-1 bg-yellow-400/10 text-yellow-600 px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                                                            <Star size={10} fill="currentColor" />
                                                            <span>{place.rating || 'N/A'}</span>
                                                            <span className="text-yellow-600/60 font-medium hidden sm:inline">({place.userRatingCount || 0})</span>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4 font-medium leading-relaxed">{place.editorialSummary || place.address}</p>

                                                    <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
                                                        <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md">
                                                            {place.priceLevel && (
                                                                <span className="text-zinc-600 flex items-center">
                                                                    <DollarSign size={10} className="text-zinc-400" />
                                                                    {place.priceLevel}
                                                                </span>
                                                            )}
                                                            {place.priceLevel && <span>•</span>}
                                                            {place.types?.[0] && (
                                                                <span className="capitalize text-zinc-500">{place.types[0].replace(/_/g, ' ')}</span>
                                                            )}
                                                        </div>
                                                        <a
                                                            href={place.googleMapsUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-[#007AFF] font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
                                                        >
                                                            Maps <ArrowRight size={14} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {!isLoading && results.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-60">
                                        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-2">
                                            <Search className="text-zinc-300" size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-zinc-400">
                                                Ready to explore?
                                            </h3>
                                            <p className="text-zinc-400 text-sm max-w-[200px] mx-auto mt-1">
                                                Enter a search term to find recommended places.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
