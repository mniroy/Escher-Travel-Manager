import { Minus, Plus } from 'lucide-react';

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

    const presets = [15, 30, 45, 60, 90, 120, 180, 240];

    return (
        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* Main Stepper */}
            <div className="flex items-center justify-between bg-zinc-50 rounded-2xl p-1 border border-zinc-100">
                <button
                    onClick={() => adjust(-15)}
                    className="w-12 h-12 rounded-xl bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-600 shadow-sm border border-zinc-200/50 active:scale-90 transition-all"
                >
                    <Minus size={18} strokeWidth={2.5} />
                </button>

                <div className="flex flex-col items-center flex-1">
                    <span className="text-xl font-black text-zinc-900 tracking-tight">
                        {formatDuration(currentMins)}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-1">
                        minutes
                    </span>
                </div>

                <button
                    onClick={() => adjust(15)}
                    className="w-12 h-12 rounded-xl bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-600 shadow-sm border border-zinc-200/50 active:scale-90 transition-all"
                >
                    <Plus size={18} strokeWidth={2.5} />
                </button>
            </div>

            {/* Grid of Presets */}
            <div className="grid grid-cols-4 gap-2">
                {presets.map(mins => (
                    <button
                        key={mins}
                        onClick={() => onSave(formatDuration(mins))}
                        className={`
                            py-2.5 rounded-xl text-[11px] font-bold transition-all border
                            ${currentMins === mins
                                ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-md shadow-blue-500/20'
                                : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'}
                        `}
                    >
                        {formatDuration(mins)}
                    </button>
                ))}
            </div>

            <button
                onClick={onClose}
                className="w-full py-4 bg-zinc-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
                Confirm
            </button>
        </div>
    );
}
