import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface TimePickerProps {
    initialTime: string; // "HH:MM AM" or "HH:MM PM"
    onSave: (time: string) => void;
    onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

// Extracted ScrollColumn to prevent re-mounting on parent re-render
const ScrollColumn = ({
    items,
    selected,
    onSelect
}: {
    items: string[];
    selected: string;
    onSelect: (val: string) => void
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial scroll position on mount
    useEffect(() => {
        if (containerRef.current) {
            const index = items.indexOf(selected);
            if (index !== -1) {
                containerRef.current.scrollTop = index * 32;
            }
        }
    }, []); // Run only on mount

    return (
        <div
            ref={containerRef}
            className="h-32 overflow-y-scroll snap-y snap-mandatory no-scrollbar w-16 py-[48px] relative z-20"
            onScroll={(e) => {
                const el = e.currentTarget;
                const index = Math.round(el.scrollTop / 32);
                if (items[index] && items[index] !== selected) {
                    onSelect(items[index]);
                }
            }}
        >
            <div className="flex flex-col items-center">
                {items.map(item => (
                    <button
                        key={item}
                        onClick={() => onSelect(item)}
                        className={`
                            snap-center h-8 w-full flex items-center justify-center text-sm font-bold transition-all shrink-0 select-none
                            ${selected === item
                                ? 'text-[#007AFF] scale-125'
                                : 'text-zinc-400 hover:text-zinc-600'}
                        `}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};

export function TimePicker({ initialTime, onSave, onClose }: TimePickerProps) {
    // Parse Initial Time
    const parseTime = (str: string) => {
        try {
            if (!str || str.startsWith('NaN')) return { hour: '12', minute: '00', period: 'AM' as const };

            const [time, period] = str.split(' ');
            const [h, m] = time.split(':');
            return {
                hour: h || '12',
                minute: m || '00',
                period: (period as 'AM' | 'PM') || 'AM'
            };
        } catch (e) {
            return { hour: '12', minute: '00', period: 'AM' as const };
        }
    };

    const { hour: initH, minute: initM, period: initP } = parseTime(initialTime);

    const [hour, setHour] = useState(initH);
    const [minute, setMinute] = useState(initM);
    const [period, setPeriod] = useState(initP);

    const handleSave = () => {
        onSave(`${hour}:${minute} ${period}`);
        onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center isolate"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-auto p-6 select-none relative z-10"
            >
                <div className="flex items-center gap-4 h-32 relative">
                    {/* Selection Highlight Bar */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-8 bg-zinc-100 rounded-lg -z-10" />

                    <ScrollColumn items={HOURS} selected={hour} onSelect={setHour} />
                    <div className="font-bold text-zinc-300 pb-1 -mx-2">:</div>
                    <ScrollColumn items={MINUTES} selected={minute} onSelect={setMinute} />
                    <div className="w-px h-12 bg-zinc-200 mx-1" />
                    <ScrollColumn items={PERIODS} selected={period} onSelect={setPeriod as any} />
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 grid grid-cols-1">
                    <button
                        onClick={handleSave}
                        className="bg-[#007AFF] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#0061C2] transition-colors flex items-center justify-center gap-2"
                    >
                        <Check size={16} strokeWidth={3} />
                        Set Time
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
