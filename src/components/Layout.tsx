import React from 'react';
import { BottomNavigation } from './BottomNavigation';
import { SyncIndicator } from './SyncIndicator';

interface LayoutProps {
    children: React.ReactNode;
    showNav?: boolean;
    fullScreen?: boolean;
}

export function Layout({ children, showNav = true, fullScreen = false }: LayoutProps) {
    if (fullScreen) {
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
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 relative overflow-hidden bg-zinc-50">
            {/* Sync Status Indicator */}
            <div className="absolute top-4 right-4 z-50">
                <SyncIndicator />
            </div>

            <main className="relative z-10 w-full md:max-w-5xl mx-auto min-h-screen shadow-2xl bg-zinc-50 shadow-zinc-200">
                {children}
            </main>

            {showNav && <BottomNavigation />}
        </div>
    );
}

