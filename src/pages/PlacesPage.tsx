import { Layout } from '../components/Layout';
import { MapPin, Search, Star, ArrowRight } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Category, CategoryFilter } from '../components/CategoryFilter';

export default function PlacesPage() {
    const { events } = useTrip();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<Category>('All');

    // Filter "Places" (Events that are locations) and matches search
    const filteredPlaces = events
        .filter(e => ['Stay', 'Eat', 'Play'].includes(e.type))
        .filter(e => {
            if (selectedCategory !== 'All' && e.type !== selectedCategory) return false;

            const query = searchQuery.toLowerCase();
            return (
                e.title.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query)
            );
        });

    return (
        <Layout>
            <div className="relative h-56 w-full group overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=80"
                    alt="Bali"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>

                <div className="absolute bottom-6 left-6">
                    <h1 className="text-4xl font-bold text-white mb-1 shadow-lg">Places</h1>
                    <p className="text-zinc-200 text-sm font-medium shadow-lg opacity-90">Your favorite spots from the itinerary.</p>
                </div>
            </div>

            <div className="px-6 py-6 pb-24">
                <div className="space-y-4 mb-8">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search places..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-zinc-700 placeholder:text-zinc-600"
                        />
                    </div>

                    <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
                </div>

                {filteredPlaces.length > 0 ? (
                    <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {filteredPlaces.map(place => (
                            <Link
                                to={`/place/${place.id}`}
                                key={place.id}
                                className="block group"
                            >
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden active:scale-[0.98] transition-all hover:bg-zinc-900 hover:border-zinc-700">
                                    <div className="h-32 bg-zinc-800 relative">
                                        <img
                                            src={`https://source.unsplash.com/random/400x200?${place.type.toLowerCase()}`}
                                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                            alt={place.title}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white uppercase tracking-wider">
                                            {place.type}
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{place.title}</h3>
                                        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{place.description}</p>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
                                                <Star size={12} fill="currentColor" />
                                                <span>{place.rating || 'New'}</span>
                                            </div>
                                            <span className="text-xs text-primary font-bold flex items-center gap-1">
                                                View Details <ArrowRight size={12} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                            <MapPin className="text-zinc-600" size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">
                                {searchQuery ? 'No matches found' : 'No places yet'}
                            </h3>
                            <p className="text-zinc-500 max-w-xs mx-auto mt-1">
                                {searchQuery
                                    ? 'Try adjusting your search terms.'
                                    : 'Add activities to your itinerary to see them here.'}
                            </p>
                        </div>
                        {/* No button here as requested */}
                    </div>
                )}
            </div>
        </Layout>
    );
}
