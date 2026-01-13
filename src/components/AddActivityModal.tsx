import { useState, useEffect } from 'react';
import { X, Loader2, MapPin, ArrowRight, Clock, Link as LinkIcon, Minus, Plus, AlertCircle, Trees } from 'lucide-react';
import { TimelineEvent } from './TimelineItem';
import { parseGoogleMapsUrl, placeTypeToEventType, isGoogleMapsUrl } from '../lib/googleMaps';
import { getArea } from '../lib/utils';

// Define a type strictly for Events, excluding 'All'
export type EventCategory = 'Transport' | 'Stay' | 'Eat' | 'Play';

interface AddActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (activity: NewActivity) => void | boolean | Promise<void | boolean>;
    initialData?: TimelineEvent | null;
    hideDuration?: boolean;
}

export interface NewActivity {
    id?: string; // Optional ID for updates
    title: string;
    type: EventCategory;
    time: string;
    description: string;
    googleMapsLink?: string;
    rating?: number;
    reviews?: number;
    image?: string;
    duration?: string;
    placeId?: string;
    lat?: number;
    lng?: number;
    address?: string;
    openingHours?: string[];
}

export function AddActivityModal({ isOpen, onClose, onSave, initialData, hideDuration = false }: AddActivityModalProps) {
    const parseDurationToMinutes = (str?: string): number => {
        if (!str) return 60; // Default 1h
        let minutes = 0;
        const hMatch = str.match(/(\d+)\s*h/);
        const mMatch = str.match(/(\d+)\s*m/);
        if (hMatch) minutes += parseInt(hMatch[1]) * 60;
        if (mMatch) minutes += parseInt(mMatch[1]);
        return minutes || 60;
    };

    const formatMinutesToDuration = (mins: number): string => {
        if (mins <= 0) return '0m';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const [step, setStep] = useState<'INPUT' | 'PREVIEW'>('INPUT');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);

    const [formData, setFormData] = useState<NewActivity>({
        title: '',
        type: 'Play',
        time: 'TBD',
        description: '',
        placeId: ''
    });

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (initialData) {
                // Edit Mode: Pre-fill data and skip to PREVIEW
                setFormData({
                    id: initialData.id,
                    title: initialData.title,
                    type: initialData.type as EventCategory,
                    time: initialData.time,
                    description: initialData.description || '',
                    googleMapsLink: initialData.googleMapsLink || '',
                    rating: initialData.rating,
                    duration: initialData.duration,
                    placeId: initialData.placeId,
                    openingHours: initialData.openingHours
                });
                setLink(initialData.googleMapsLink || '');
                setDurationMinutes(parseDurationToMinutes(initialData.duration));
                setStep('PREVIEW');
            } else {
                // Add Mode: Reset
                setStep('INPUT');
                setLink('');
                setDurationMinutes(60); // Default 1h
                setFormData({ title: '', type: 'Play', time: 'TBD', description: '', placeId: '' });
            }
        }
    }, [isOpen, initialData]);

    const adjustDuration = (delta: number) => {
        setDurationMinutes(prev => Math.max(0, prev + delta));
    };

    if (!isOpen) return null;

    const handleSmartFill = async () => {
        if (!link) return;
        setIsLoading(true);
        setError(null);

        // Check if it's a valid Google Maps URL
        if (!isGoogleMapsUrl(link)) {
            setError('Please paste a valid Google Maps link');
            setIsLoading(false);
            return;
        }

        try {
            const result = await parseGoogleMapsUrl(link);

            if (!result.success || !result.data) {
                setError(result.error || 'Failed to fetch place details');
                setIsLoading(false);
                return;
            }

            const place = result.data;
            console.log('DEBUG: API result:', place);
            console.log('DEBUG: openingHours:', place.openingHours);

            setFormData(prev => ({
                ...prev,
                title: place.name,
                type: placeTypeToEventType(place.types),
                description: place.address,
                googleMapsLink: place.googleMapsUrl,
                rating: place.rating,
                reviews: place.reviewCount,
                image: place.photos?.[0],
                placeId: place.placeId, // Save the place ID
                lat: place.lat,         // Save coordinates for Routes API
                lng: place.lng,
                address: place.address,
                openingHours: place.openingHours
            }));

            setStep('PREVIEW');
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        console.log('!!! [AddActivityModal] Confirming with:', formData.openingHours);
        const result = await onSave({
            ...formData,
            googleMapsLink: link,
            duration: formatMinutesToDuration(durationMinutes),
            placeId: formData.placeId,
            lat: formData.lat,
            lng: formData.lng,
            address: formData.address,
            openingHours: formData.openingHours
        });

        // If onSave returns explicitly false, do not close the modal
        if (result !== false) {
            onClose();
        }
    };

    const resetAndClose = () => {
        onClose();
        // Delay reset slightly to avoid UI flicker during close animation
        setTimeout(() => {
            setStep('INPUT');
            setLink('');
            setDurationMinutes(60);
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />

            <div className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden ${step === 'PREVIEW' ? 'scale-105' : 'scale-100'}`}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                            {step === 'INPUT' && <Trees className="text-emerald-500" size={24} />}
                            {step === 'INPUT' ? 'Add a Place' : (initialData ? 'Edit Details' : 'Confirm Details')}
                        </h2>
                        <button onClick={resetAndClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {step === 'INPUT' ? (
                        /* INPUT STEP */
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                            <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-[#007AFF] shadow-sm border border-blue-100">
                                    <MapPin size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 mb-1">Paste Google Maps Link</h3>
                                <p className="text-sm text-zinc-500 mb-6">We'll automatically extract the details.</p>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={link}
                                        onChange={(e) => { setLink(e.target.value); setError(null); }}
                                        placeholder="https://goo.gl/maps/..."
                                        className={`flex-1 bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm text-zinc-900 placeholder:text-zinc-400 ${error ? 'border-red-300 focus:border-red-400' : 'border-zinc-200 focus:border-blue-300'}`}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSmartFill()}
                                    />
                                    <button
                                        onClick={handleSmartFill}
                                        disabled={isLoading || !link}
                                        className="bg-[#007AFF] text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:bg-[#0061c2] active:scale-95 transition-all"
                                    >
                                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                                    </button>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100">
                                        <AlertCircle size={14} />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* PREVIEW / EDIT STEP */
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* Preview Card */}
                            <div className="bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
                                <div className="h-40 bg-zinc-200 relative overflow-hidden group">
                                    {formData.image ? (
                                        <img src={formData.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-300">
                                            <MapPin size={48} />
                                        </div>
                                    )}

                                    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />

                                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/20 shadow-sm">
                                        {formData.type}
                                    </div>

                                    <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                                    <div className="absolute bottom-3 left-4 right-4 text-white">
                                        <h3 className="text-xl font-bold leading-tight drop-shadow-md line-clamp-2">{formData.title}</h3>
                                        <div className="flex items-center gap-1 mt-1 text-xs font-medium text-white/90">
                                            <span className="opacity-80 line-clamp-1">{getArea(formData.address)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {/* Editable Fields */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Duration Stepper */}
                                        {!hideDuration && (
                                            <div className="col-span-2 flex items-center justify-between bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                                                <div className="flex items-center gap-2 text-zinc-500 px-1">
                                                    <Clock size={16} />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Duration</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => adjustDuration(-30)}
                                                        className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors"
                                                    >
                                                        <Minus size={14} strokeWidth={3} />
                                                    </button>
                                                    <span className="text-zinc-900 font-bold min-w-[60px] text-center text-sm">
                                                        {formatMinutesToDuration(durationMinutes)}
                                                    </span>
                                                    <button
                                                        onClick={() => adjustDuration(30)}
                                                        className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors"
                                                    >
                                                        <Plus size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Link Input */}
                                        <div className="col-span-2 flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                                            <LinkIcon size={16} className="text-zinc-400 shrink-0" />
                                            <input
                                                type="text"
                                                value={link}
                                                onChange={(e) => setLink(e.target.value)}
                                                placeholder="Google Maps Link"
                                                className="bg-transparent border-none text-sm text-zinc-900 focus:outline-none w-full placeholder:text-zinc-400 font-medium truncate"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('INPUT')}
                                    className="flex-1 py-3.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                                >
                                    {initialData ? 'Back' : 'Paste New Link'}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-[2] bg-[#007AFF] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {initialData ? 'Save Changes' : 'Confirm Insert'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
