import { Layout } from '../components/Layout';
import { Car, Locate } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useState } from 'react';

export default function MapPage() {
    const { tripDates } = useTrip();
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);

    const selectedDate = tripDates.find(d => d.offset === selectedDayOffset) || tripDates[0];

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
                            <p className="text-sm text-zinc-400">Optimized for {selectedDate?.fullDate} • 4 stops</p>
                        </div>
                        <button className="w-12 h-12 rounded-full bg-[#007AFF] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all">
                            <Locate size={22} />
                        </button>
                    </div>

                    <div className="space-y-0 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-4 bottom-4 left-[15px] w-[2px] bg-zinc-800" />

                        <RouteStop title="Zurich Airport" time="3:00 PM" active first />
                        <RouteStop title="Elfrentes Roasting" time="4:15 PM" />
                        <RouteStop title="Old Town Walk" time="5:30 PM" />
                        <RouteStop title="Elmira Dining" time="7:00 PM" last />
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

function RouteStop({ title, time, active, first: _first, last }: { title: string; time: string; active?: boolean; first?: boolean; last?: boolean }) {
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
                <p className="text-xs text-zinc-600">{time}</p>
            </div>
        </div>
    )
}
