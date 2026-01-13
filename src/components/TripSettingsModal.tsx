import { X, Calendar, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TripSettings {
    tripName: string;
    startDate: string; // YYYY-MM-DD format
    duration: number;
}

interface TripSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: TripSettings) => void;
    initialSettings: TripSettings;
}

export function TripSettingsModal({ isOpen, onClose, onSave, initialSettings }: TripSettingsModalProps) {
    const [tripName, setTripName] = useState(initialSettings.tripName);
    const [startDate, setStartDate] = useState(initialSettings.startDate);
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTripName(initialSettings.tripName);
            setStartDate(initialSettings.startDate);
            // Calculate end date based on duration
            // Treat string as UTC midnight to avoid timezone shifts
            const start = new Date(initialSettings.startDate);
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + (initialSettings.duration - 1));
            setEndDate(end.toISOString().split('T')[0]);
        }
    }, [isOpen, initialSettings]);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value;
        setStartDate(newStart);
        // If new start is after end, push end to match
        if (newStart > endDate) {
            setEndDate(newStart);
        }
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEnd = e.target.value;
        // Prevent end before start? Or let it map to 1 day if invalid?
        // Better to Clamp.
        if (newEnd < startDate) {
            // Do nothing or warning?
            // For now, simple clamp
            setEndDate(startDate);
        } else {
            setEndDate(newEnd);
        }
    };

    const handleSave = () => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const duration = Math.max(1, diffDays + 1);

        onSave({
            tripName,
            startDate,
            duration
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#121212] border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <h2 className="text-lg font-bold text-white mb-1">Trip Settings</h2>
                    <p className="text-zinc-500 text-xs">Update your trip details</p>
                </div>

                <div className="space-y-5">
                    {/* Trip Name */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Trip Name</label>
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                            <input
                                type="text"
                                value={tripName}
                                onChange={(e) => setTripName(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium text-sm"
                                placeholder="e.g. Bali Summer Trip"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Start Date</label>
                            <div className="relative group">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={handleStartDateChange}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium text-xs [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">End Date</label>
                            <div className="relative group">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={handleEndDateChange}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium text-xs [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#007AFF] text-white hover:bg-[#0069d9] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
