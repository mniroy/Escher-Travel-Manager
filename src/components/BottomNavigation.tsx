import { Map, Calendar, MapPin, FileText } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

export function BottomNavigation() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 px-6 py-2 pb-4">
            <div className="flex justify-between items-end max-w-sm mx-auto h-12">
                <NavLink to="/" icon={<Calendar size={20} strokeWidth={2.5} />} active={isActive('/')} label="Itinerary" />
                <NavLink to="/places" icon={<MapPin size={20} strokeWidth={2.5} />} active={isActive('/places')} label="Places" />
                <NavLink to="/map" icon={<Map size={20} strokeWidth={2.5} />} active={isActive('/map')} label="Route" />
                <NavLink to="/documents" icon={<FileText size={20} strokeWidth={2.5} />} active={isActive('/documents')} label="Documents" />
            </div>
        </nav>
    );
}

function NavLink({ to, icon, active, label }: { to: string; icon: React.ReactNode; active: boolean; label: string }) {
    return (
        <Link
            to={to}
            className={`
                relative flex items-center justify-center transition-all duration-300 
                ${active
                    ? 'w-14 h-14 bg-white text-black rounded-full -translate-y-6 shadow-[0_0_15px_rgba(255,255,255,0.3)] border-[5px] border-black scale-110'
                    : 'w-12 h-12 text-zinc-500 hover:text-zinc-300 active:scale-95'
                }
            `}
        >
            {icon}
            {/* Optional dot for active state if we didn't do the big cutout */}
            {/* <span className="sr-only">{label}</span> */}
        </Link>
    );
}
