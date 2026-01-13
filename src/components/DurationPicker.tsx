import { Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface DurationPickerProps {
    durationStr: string;
    onSave: (newDuration: string) => void;
    onClose: () => void;
}

const parseDuration = (str: string) => {
    if (!str) return 60;
    const hMatch = str.match(/(\d+)h/);
    const mMatch = str.match(/(\d+)m/);
    let m = 0;
    if (hMatch) m += parseInt(hMatch[1]) * 60;
    if (mMatch) m += parseInt(mMatch[1]);
    return m || 60;
};

const formatDuration = (mins: number) => {
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    return `${m}m`;
};

export function DurationPicker({ durationStr, onSave, onClose }: DurationPickerProps) {
    const currentMins = parseDuration(durationStr);

    const adjust = (delta: number) => {
        const newMins = Math.max(15, currentMins + delta); // Minimum 15 mins
        onSave(formatDuration(newMins));
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2 shadow-2xl z-50 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => adjust(-15)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                    <Minus size={14} strokeWidth={3} />
                </button>
                <div className="text-sm font-bold text-white min-w-[3rem] text-center">
                    {formatDuration(currentMins)}
                </div>
                <button
                    onClick={() => adjust(15)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                    <Plus size={14} strokeWidth={3} />
                </button>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-white/10">
                {[30, 60, 90].map(mins => (
                    <button
                        key={mins}
                        onClick={() => onSave(formatDuration(mins))}
                        className={`text-[10px] font-bold py-1 rounded hover:bg-white/10 transition-colors ${currentMins === mins ? 'bg-white/20 text-white' : 'text-slate-400'}`}
                    >
                        {formatDuration(mins)}
                    </button>
                ))}
            </div>

            <button
                onClick={onClose}
                className="w-full mt-2 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors"
            >
                Done
            </button>

            {/* Close Overlay */}
            <div className="fixed inset-0 z-[-1]" onClick={onClose} />
        </motion.div>
    );
}
