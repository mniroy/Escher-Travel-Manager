import { Layout } from '../components/Layout';
import { MapPin, Navigation, Car } from 'lucide-react';

export default function MapPage() {
    return (
        <Layout>
            <div className="relative h-[calc(100vh-80px)] w-full overflow-hidden">
                {/* Mock Map Background */}
                <div className="absolute inset-0 bg-surface/50 flex items-center justify-center">
                    <div className="text-center p-8 opacity-50">
                        <div className="grid grid-cols-4 gap-4 rotate-12 scale-150 blur-sm">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="w-24 h-24 bg-white/5 rounded-lg border border-white/10" />
                            ))}
                        </div>
                    </div>
                    <p className="absolute text-muted font-bold tracking-widest pointer-events-none">MAP VIEW MOCK</p>
                </div>

                {/* Floating Route Card */}
                <div className="absolute bottom-6 left-6 right-6 glass-panel p-5 rounded-2xl border border-white/10 shadow-glass">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-white font-bold text-lg">Smart Route</h3>
                            <p className="text-sm text-muted">Optimized for 21 Aug • 4 stops</p>
                        </div>
                        <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background shadow-glow">
                            <Navigation size={20} />
                        </button>
                    </div>

                    <div className="space-y-4 relative">
                        <div className="absolute top-2 bottom-2 left-[15px] w-[2px] bg-white/10" />

                        <RouteStop title="Zurich Airport" time="3:00 PM" active />
                        <RouteStop title="Elfrentes Roasting" time="4:15 PM" />
                        <RouteStop title="Old Town Walk" time="5:30 PM" />
                        <RouteStop title="Elmira Dining" time="7:00 PM" />
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function RouteStop({ title, time, active }: { title: string; time: string; active?: boolean }) {
    return (
        <div className="flex items-center gap-4 relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${active ? 'bg-primary border-primary text-background' : 'bg-surface border-white/20 text-muted'}`}>
                {active ? <Car size={14} /> : <div className="w-2 h-2 rounded-full bg-white/30" />}
            </div>
            <div>
                <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted'}`}>{title}</p>
                <p className="text-xs text-muted">{time}</p>
            </div>
        </div>
    )
}
