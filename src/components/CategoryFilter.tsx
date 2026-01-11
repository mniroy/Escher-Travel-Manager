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
        { id: 'Transport', icon: <Plane size={16} />, label: 'Transport' },
        { id: 'Eat', icon: <Coffee size={16} />, label: 'Eat' },
        { id: 'Play', icon: <Ticket size={16} />, label: 'Play' },
        { id: 'Stay', icon: <Bed size={16} />, label: 'Stay' },
    ];

    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-6">
            {categories.map((cat) => (
                <button
                    key={cat.id}
                    onClick={() => onSelect(cat.id)}
                    className={`
                        flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all border
                        ${selected === cat.id
                            ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-md shadow-blue-500/40 transform scale-105'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white'
                        }
                    `}
                >
                    {React.cloneElement(cat.icon as React.ReactElement, { size: 14 })}
                    <span className="text-xs font-bold">{cat.label}</span>
                </button>
            ))}
        </div>
    );
}
