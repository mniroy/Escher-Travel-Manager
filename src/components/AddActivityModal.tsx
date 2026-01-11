import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, MapPin, ArrowRight, Clock, Link as LinkIcon, Minus, Plus, Plane, Coffee, Bed, Ticket } from 'lucide-react';
import { TimelineEvent } from './TimelineItem';

// Define a type strictly for Events, excluding 'All'
export type EventCategory = 'Transport' | 'Stay' | 'Eat' | 'Play';

interface AddActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (activity: NewActivity) => void;
    initialData?: TimelineEvent | null;
}

export interface NewActivity {
    id?: string; // Optional ID for updates
    title: string;
    type: EventCategory;
    time: string;
    description: string;
    googleMapsLink?: string;
    rating?: number;
    image?: string;
    duration?: string;
}

export function AddActivityModal({ isOpen, onClose, onSave, initialData }: AddActivityModalProps) {
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
    const [link, setLink] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);

    const [formData, setFormData] = useState<NewActivity>({
        title: '',
        type: 'Play',
        time: 'TBD',
        description: ''
    });

    useEffect(() => {
        if (isOpen) {
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
                    duration: initialData.duration
                });
                setLink(initialData.googleMapsLink || '');
                setDurationMinutes(parseDurationToMinutes(initialData.duration));
                setStep('PREVIEW');
            } else {
                // Add Mode: Reset
                setStep('INPUT');
                setLink('');
                setDurationMinutes(60); // Default 1h
                setFormData({ title: '', type: 'Play', time: 'TBD', description: '' });
            }
        }
    }, [isOpen, initialData]);

    const adjustDuration = (delta: number) => {
        setDurationMinutes(prev => Math.max(0, prev + delta));
    };

    if (!isOpen) return null;

    const handleSmartFill = () => {
        if (!link) return;
        setIsLoading(true);

        // Mock API Call delay
        setTimeout(() => {
            let mockData: Partial<NewActivity> = {
                title: 'New Location',
                type: 'Play',
                description: 'Added via Smart Fill',
                rating: 4.5
            };

            const lowerLink = link.toLowerCase();
            if (lowerLink.includes('coffee') || lowerLink.includes('starbucks')) {
                mockData = { title: 'Starbucks Reserve', type: 'Eat', description: 'Coffee break.', rating: 4.6 };
            } else if (lowerLink.includes('museum')) {
                mockData = { title: 'National Museum', type: 'Play', description: 'Art and history tour.', rating: 4.8 };
            } else if (lowerLink.includes('hotel')) {
                mockData = { title: 'Grand Hotel', type: 'Stay', description: 'Check-in time.', rating: 4.9 };
            } else if (lowerLink.includes('airport') || lowerLink.includes('station')) {
                mockData = { title: 'Central Station', type: 'Transport', description: 'Train to next city.', rating: 4.2 };
            } else if (lowerLink.includes('restaurant') || lowerLink.includes('food')) {
                mockData = { title: 'Local Delicacy', type: 'Eat', description: 'Lunch reservation.', rating: 4.7 };
            }

            setFormData(prev => ({ ...prev, ...mockData, googleMapsLink: link }));
            setIsLoading(false);
            setStep('PREVIEW');
        }, 1500);
    };

    const handleConfirm = () => {
        onSave({
            ...formData,
            googleMapsLink: link,
            duration: formatMinutesToDuration(durationMinutes)
        });
        onClose();
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

            <div className={`relative w-full max-w-lg bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 overflow-hidden ${step === 'PREVIEW' ? 'scale-105' : 'scale-100'}`}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="text-primary" size={20} />
                            {step === 'INPUT' ? 'Add Activity' : (initialData ? 'Edit Details' : 'Confirm Details')}
                        </h2>
                        <button onClick={resetAndClose} className="p-2 hover:bg-white/5 rounded-full text-muted transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {step === 'INPUT' ? (
                        /* INPUT STEP */
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                            <div className="p-6 bg-primary/10 rounded-xl border border-primary/20 text-center">
                                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
                                    <MapPin size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-1">Paste Google Maps Link</h3>
                                <p className="text-sm text-muted mb-4">We'll insert the location here in your itinerary.</p>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={link}
                                        onChange={(e) => setLink(e.target.value)}
                                        placeholder="https://goo.gl/maps/..."
                                        className="flex-1 bg-background border border-primary/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSmartFill()}
                                    />
                                    <button
                                        onClick={handleSmartFill}
                                        disabled={isLoading || !link}
                                        className="bg-primary text-background font-bold px-6 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                                    >
                                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* PREVIEW / EDIT STEP */
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* Preview Card */}
                            <div className="bg-surface rounded-xl overflow-hidden border border-white/10">
                                <div className="h-32 bg-gray-700 relative">
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-60" />
                                    <div className="absolute bottom-3 left-4">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="text-xs font-bold bg-primary text-background px-2 py-0.5 rounded flex items-center gap-1">
                                                {/* Icon Logic Inline or Helper */}
                                                {formData.type === 'Transport' && <Plane size={12} fill="currentColor" className="opacity-80" />}
                                                {formData.type === 'Eat' && <Coffee size={12} fill="currentColor" className="opacity-80" />}
                                                {formData.type === 'Stay' && <Bed size={12} fill="currentColor" className="opacity-80" />}
                                                {(formData.type === 'Play' || !['Transport', 'Eat', 'Stay'].includes(formData.type)) && <Ticket size={12} fill="currentColor" className="opacity-80" />}
                                                {formData.type}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white max-w-[80%] leading-tight">{formData.title}</h3>
                                    </div>
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* Editable Fields */}
                                    <div className="space-y-3">
                                        {/* Link Input */}
                                        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
                                            <LinkIcon size={16} className="text-muted" />
                                            <input
                                                type="text"
                                                value={link}
                                                onChange={(e) => setLink(e.target.value)}
                                                placeholder="Google Maps Link"
                                                className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder-gray-500"
                                            />
                                        </div>

                                        {/* Duration Stepper */}
                                        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5 justify-between">
                                            <div className="flex items-center gap-2 text-muted px-2">
                                                <Clock size={16} />
                                                <span className="text-sm">Duration</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => adjustDuration(-30)}
                                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <Minus size={14} strokeWidth={3} />
                                                </button>
                                                <span className="text-white font-mono font-medium min-w-[70px] text-center">
                                                    {formatMinutesToDuration(durationMinutes)}
                                                </span>
                                                <button
                                                    onClick={() => adjustDuration(30)}
                                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted pt-2 border-t border-white/5">
                                        <span className="text-xs opacity-50 truncate max-w-[200px]">{formData.description}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('INPUT')}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5 transition-colors"
                                >
                                    {initialData ? 'Back' : 'Paste New Link'}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-[2] bg-primary text-background font-bold py-3 rounded-xl shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
