import { Plane, Coffee, Ticket, Bed, MapPin } from 'lucide-react';
import React from 'react';

export type Category = 'All' | 'Transport' | 'Stay' | 'Eat' | 'Play';

interface CategoryFilterProps {
    selected: Category;
    onSelect: (category: Category) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
    const categories: { id: Category; icon: React.ReactNode; label: string }[] = [
        { id: 'All', icon: <MapPin size={16} />, label: 'All' },
        { id: 'Transport', icon: <Plane size={16} />, label: 'GO' }, // Renamed from Transport to fit
        { id: 'Stay', icon: <Bed size={16} />, label: 'Stay' },
        { id: 'Eat', icon: <Coffee size={16} />, label: 'Eat' },
        { id: 'Play', icon: <Ticket size={16} />, label: 'Play' },
    ];

    return (
        <div className="flex justify-between items-center gap-2 px-6 w-full pt-2">
            {categories.map((cat) => (
                <button
                    key={cat.id}
                    onClick={() => onSelect(cat.id)}
                    className={`
                        flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-2xl transition-all border min-w-0
                        ${selected === cat.id
                            ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-lg shadow-blue-500/30'
                            : 'bg-white text-zinc-500 border-zinc-100/50 hover:bg-zinc-50 hover:border-zinc-200'
                        }
                    `}
                >
                    {React.cloneElement(cat.icon as React.ReactElement, { size: 18 })}
                    <span className="text-[9px] font-bold uppercase tracking-wider">{cat.label}</span>
                </button>
            ))}
        </div>
    );
}
