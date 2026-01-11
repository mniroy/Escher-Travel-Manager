import React from 'react';
import { BottomNavigation } from './BottomNavigation';
import { SyncIndicator } from './SyncIndicator';

interface LayoutProps {
    children: React.ReactNode;
    showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
    return (
        <div className="min-h-screen pb-24 relative overflow-hidden bg-black">
            {/* Sync Status Indicator */}
            <div className="fixed top-4 right-4 z-50">
                <SyncIndicator />
            </div>

            <main className="relative z-10 w-full md:max-w-5xl mx-auto min-h-screen shadow-2xl bg-black shadow-zinc-900/20">
                {children}
            </main>

            {showNav && <BottomNavigation />}
        </div>
    );
}

