import { X, Calendar, Clock, MapPin } from 'lucide-react';
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
    const [settings, setSettings] = useState<TripSettings>(initialSettings);

    useEffect(() => {
        if (isOpen) {
            setSettings(initialSettings);
        }
    }, [isOpen, initialSettings]);

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
                    <h2 className="text-xl font-bold text-white mb-1">Trip Settings</h2>
                    <p className="text-zinc-500 text-sm">Update your trip details</p>
                </div>

                <div className="space-y-5">
                    {/* Trip Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Trip Name</label>
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                            <input
                                type="text"
                                value={settings.tripName}
                                onChange={(e) => setSettings({ ...settings, tripName: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium"
                                placeholder="e.g. Bali Summer Trip"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Start Date</label>
                            <div className="relative group">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                                <input
                                    type="date"
                                    value={settings.startDate}
                                    onChange={(e) => setSettings({ ...settings, startDate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Duration (Days)</label>
                            <div className="relative group">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={settings.duration}
                                    onChange={(e) => setSettings({ ...settings, duration: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all font-medium"
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
                        onClick={() => onSave(settings)}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#007AFF] text-white hover:bg-[#0069d9] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
