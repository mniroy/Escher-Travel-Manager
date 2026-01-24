import React from 'react';
import { useLocation } from 'react-router-dom';
import { BottomNavigation } from './BottomNavigation';
import { SyncIndicator } from './SyncIndicator';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
    showNav?: boolean;
    fullScreen?: boolean;
}

export function Layout({ children, showNav = true, fullScreen = false }: LayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const location = useLocation();
    const isSummaryPage = location.pathname === '/summary';

    if (fullScreen) {
        // ... (fullscreen logic) ...
        return (
            <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden overscroll-none bg-zinc-50 z-0 touch-none">
                <main className="relative w-full h-full md:max-w-5xl mx-auto bg-zinc-50 shadow-2xl shadow-zinc-200">
                    {children}
                </main>
                {showNav && <BottomNavigation />}

                {/* Sync Status Indicator (Fixed relative to viewport) */}
                <div className="absolute top-4 right-4 z-50 pointer-events-none">
                    <SyncIndicator />
                </div>

                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 relative overflow-hidden bg-zinc-50 font-sans">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Header */}
            {/* Header - Nav Controls (under content, above bg) */}
            <div className="fixed top-0 left-0 z-[1] px-6 pt-14 pb-4 flex items-center gap-4">
                {isSummaryPage && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-white rounded-full hover:bg-white/10 transition-colors z-50 relative"
                    >
                        <Menu size={24} strokeWidth={2} />
                    </button>
                )}
                {/* Sync Status Indicator */}
                <SyncIndicator />
            </div>


            <main className="relative w-full md:max-w-5xl mx-auto min-h-screen">
                {children}
            </main>

            {showNav && <BottomNavigation />}
        </div>
    );
}

