import { useState, useMemo } from 'react';
import { X, Search, Plus, Minus, MapPin } from 'lucide-react';
import { TimelineEvent } from './TimelineItem';
import { motion } from 'framer-motion';

interface PlaceSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    savedPlaces: TimelineEvent[];
    onSelectPlace: (place: TimelineEvent, durationMinutes: number) => void;
    onAddNew: () => void; // Fallback to add new scratch place
}

export function PlaceSelectorModal({ isOpen, onClose, savedPlaces, onSelectPlace, onAddNew }: PlaceSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [durationMinutes, setDurationMinutes] = useState<{ [key: string]: number }>({});

    const filteredPlaces = useMemo(() => {
        return savedPlaces.filter(p =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [savedPlaces, searchQuery]);

    const getDuration = (id: string) => durationMinutes[id] || 60;

    const adjustDuration = (id: string, delta: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setDurationMinutes(prev => ({
            ...prev,
            [id]: Math.max(30, (prev[id] || 60) + delta)
        }));
    };

    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const handleSelect = (place: TimelineEvent) => {
        onSelectPlace(place, getDuration(place.id));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900">Add from Library</h2>
                        <p className="text-xs text-zinc-500">Choose a saved place to schedule</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-white border-b border-zinc-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search your places..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all font-medium text-zinc-700"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50">
                    {filteredPlaces.length > 0 ? (
                        filteredPlaces.map(place => (
                            <div
                                key={place.id}
                                onClick={() => setSelectedId(place.id)}
                                className={`bg-white rounded-xl border border-zinc-100 shadow-sm p-3 transition-all cursor-pointer group hover:border-blue-200 ${selectedId === place.id ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{place.type}</span>
                                            <h3 className="font-bold text-zinc-900 text-sm line-clamp-1">{place.title}</h3>
                                        </div>
                                        <p className="text-xs text-zinc-500 line-clamp-2">{place.description}</p>
                                    </div>

                                    {/* Duration Controls */}
                                    <div className="flex items-center gap-2 bg-zinc-50 rounded-lg p-1 border border-zinc-200" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => adjustDuration(place.id, -30, e)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                                        >
                                            <Minus size={12} strokeWidth={3} />
                                        </button>
                                        <span className="text-xs font-bold text-zinc-700 min-w-[40px] text-center">
                                            {formatDuration(getDuration(place.id))}
                                        </span>
                                        <button
                                            onClick={(e) => adjustDuration(place.id, 30, e)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                                        >
                                            <Plus size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSelect(place); }}
                                    className="w-full mt-3 bg-[#007AFF] text-white py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                >
                                    Add to Itinerary
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-400">
                            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                                <Search size={20} className="opacity-50" />
                            </div>
                            <p className="text-sm font-medium">No matches found</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-zinc-100">
                    <button
                        onClick={onAddNew}
                        className="w-full py-3 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center gap-2"
                    >
                        <MapPin size={16} /> Paste Google Maps Link
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
