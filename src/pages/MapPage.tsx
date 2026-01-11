import { Layout } from '../components/Layout';
import { Car, Locate, MapPin } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState } from 'react';

export default function MapPage() {
    const { tripDates, events } = useTrip();
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);

    const selectedDate = tripDates.find(d => d.offset === selectedDayOffset) || tripDates[0];

    // Filter events for the selected day and sort by time
    const dayEvents = events
        .filter(e => e.dayOffset === selectedDayOffset)
        .sort((a, b) => {
            const timeA = parseTime(a.time);
            const timeB = parseTime(b.time);
            return timeA - timeB;
        });

    return (
        <Layout>
            <div className="relative h-[calc(100vh-80px)] w-full overflow-hidden bg-zinc-950">
                {/* Mock Map Background (Dark Mode) */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {/* Mock Map Elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-zinc-700 font-bold tracking-widest text-xl opacity-20">MAP VIEW</p>
                </div>

                {/* Floating Route Card */}
                <div className="absolute bottom-36 left-6 right-6 bg-zinc-900/90 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl z-20">
                    <div className="flex justify-between items-start mb-5">
                        <div>
                            <h3 className="text-white font-bold text-lg">Smart Route</h3>
                            <p className="text-sm text-zinc-400">
                                Optimized for {selectedDate?.fullDate} • {dayEvents.length} stops
                            </p>
                        </div>
                        <button className="w-12 h-12 rounded-full bg-[#007AFF] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all">
                            <Locate size={22} />
                        </button>
                    </div>

                    <div className="space-y-0 relative max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Connecting Line */}
                        {dayEvents.length > 1 && (
                            <div className="absolute top-4 bottom-4 left-[15px] w-[2px] bg-zinc-800" />
                        )}

                        {dayEvents.length > 0 ? (
                            dayEvents.map((event, index) => (
                                <RouteStop
                                    key={event.id}
                                    title={event.title}
                                    time={event.time}
                                    // Highlight the "next" event or just the first one for now
                                    active={index === 0}
                                    last={index === dayEvents.length - 1}
                                    type={event.type}
                                />
                            ))
                        ) : (
                            <div className="text-center py-8 text-zinc-500">
                                <MapPin className="mx-auto mb-2 opacity-50" size={24} />
                                <p className="text-sm">No activities planned for this day.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Date Picker Overlay (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-zinc-900/95 backdrop-blur-xl border-t border-white/5 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar">
                        {tripDates.map((dateItem) => (
                            <button
                                key={dateItem.offset}
                                onClick={() => setSelectedDayOffset(dateItem.offset)}
                                className={`
                                    flex flex-col items-center justify-center min-w-[3.5rem] h-14 rounded-xl border transition-all duration-200
                                    ${selectedDayOffset === dateItem.offset
                                        ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-lg shadow-blue-500/25 scale-105'
                                        : 'bg-zinc-800/50 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                    }
                                `}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{dateItem.dayName}</span>
                                <span className="text-lg font-bold">{dateItem.dateNum}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function RouteStop({ title, time, active, last, type }: { title: string; time: string; active?: boolean; last?: boolean; type?: string }) {
    return (
        <div className={`flex items-center gap-4 relative z-10 ${!last ? 'pb-6' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors 
                ${active
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-md shadow-blue-900/20'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
            >
                {active ? <Car size={14} /> : <div className="w-2 h-2 rounded-full bg-zinc-700" />}
            </div>
            <div>
                <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-zinc-500'}`}>{title}</p>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-600">{time}</p>
                    {type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">{type}</span>}
                </div>
            </div>
        </div>
    )
}

// Helper to parse "9:00 AM" into minutes for sorting
function parseTime(timeStr: string): number {
    if (!timeStr || timeStr === 'TBD') return 9999; // Put undefined times at the end
    try {
        const [time, period] = timeStr.split(' ');
        if (!time || !period) return 9999;

        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    } catch {
        return 9999;
    }
}

