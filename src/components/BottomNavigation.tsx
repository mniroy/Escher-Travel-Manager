import { Map, Calendar, MapPin, FileText, LayoutDashboard, History } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

export function BottomNavigation() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-zinc-200 px-6 py-2 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-center max-w-sm mx-auto h-12">
                <NavLink to="/summary" icon={<LayoutDashboard size={20} strokeWidth={2.5} />} active={isActive('/summary')} label="Summary" />
                <NavLink to="/places" icon={<MapPin size={20} strokeWidth={2.5} />} active={isActive('/places')} label="Places" />
                <NavLink to="/" icon={<Calendar size={20} strokeWidth={2.5} />} active={isActive('/')} label="Itinerary" />
                <NavLink to="/map" icon={<Map size={20} strokeWidth={2.5} />} active={isActive('/map')} label="Route" />
                <NavLink to="/history" icon={<History size={20} strokeWidth={2.5} />} active={isActive('/history')} label="History" />
                <NavLink to="/documents" icon={<FileText size={20} strokeWidth={2.5} />} active={isActive('/documents')} label="Documents" />
            </div>
        </nav>
    );
}

function NavLink({ to, icon, active, label: _label }: { to: string; icon: React.ReactNode; active: boolean; label: string }) {
    return (
        <Link
            to={to}
            className={`
                relative flex flex-col items-center justify-center transition-all duration-200 mt-2
                ${active
                    ? 'text-[#007AFF] scale-100'
                    : 'text-zinc-400 hover:text-zinc-600 active:scale-95'
                }
            `}
        >
            <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-blue-50' : 'bg-transparent'}`}>
                {icon}
            </div>
            {active && <div className="w-1 h-1 bg-[#007AFF] rounded-full mt-1" />}
            {/* Optional dot for active state if we didn't do the big cutout */}
            {/* <span className="sr-only">{label}</span> */}
        </Link>
    );
}
