import { ArrowRight, Star, Clock, CheckCircle2, XCircle, Undo2, Plane, Pencil, Timer, Car, MapPin } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { TimePicker } from './TimePicker';

// Helper: Parse hours from "9:00 AM – 5:00 PM" string
const parseTimeStr = (t: string) => {
    try {
        const [time, period] = t.trim().split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    } catch { return 0; }
};

const getTodayHours = (hours: string[] | undefined) => {
    if (!hours || !Array.isArray(hours) || hours.length === 0) return null;
    // Just pick the first one for now as we don't have day context easily
    // In a real app we'd match the specific date
    const todayStr = hours.find(h => !h.includes("Closed")) || hours[0];
    if (!todayStr) return null;

    // Extract "9:00 AM – 5:00 PM"
    // Google format: "Monday: 9:00 AM – 5:00 PM"
    const match = todayStr.match(/(\d{1,2}:\d{2}\s[AP]M)\s–\s(\d{1,2}:\d{2}\s[AP]M)/);
    if (match) {
        return {
            text: todayStr, // Show full string e.g. "Monday: ..."
            open: parseTimeStr(match[1]),
            close: parseTimeStr(match[2])
        };
    }
    return { text: todayStr, open: 0, close: 24 * 60 }; // Fallback
};

const getTimeColor = (eventTime: string, open: number, close: number) => {
    const time = parseTimeStr(eventTime);
    if (!time) return 'text-white/90'; // Default

    // Check if Closed
    if (time < open || time > close) return 'text-red-400';

    // Check if Closing Soon (within 60 mins)
    if (close - time <= 60 && close - time > 0) return 'text-yellow-400';

    return 'text-white/90';
};

export interface TimelineEvent {
    id: string;
    type: 'Transport' | 'Stay' | 'Eat' | 'Play';
    title: string;
    time: string;
    endTime?: string;
    description?: string;
    rating?: number;
    reviews?: number;
    image?: string;
    status?: string | 'Checked In' | 'Skipped';
    duration?: string;
    googleMapsLink?: string;
    travelTime?: string;
    travelMode?: 'drive' | 'walk' | 'transit';
    dayOffset?: number;
    // Google Places data
    photos?: string[];
    openingHours?: string[];
    isOpen?: boolean;
    userReviews?: {
        name: string;
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string; photoUri?: string };
        relativePublishTimeDescription: string;
    }[];
    placeId?: string;
    address?: string;
    lat?: number;
    lng?: number;
    congestion?: 'low' | 'moderate' | 'high';
    travelDistance?: string;
    parkingBuffer?: number; // in minutes, default 10
    isStart?: boolean;
    isEnd?: boolean;
}

interface TimelineItemProps {
    event: TimelineEvent;
    isLast?: boolean;
    isFirst?: boolean;
    icon: ReactNode;
    onClick?: () => void;
    onCheckIn?: (id: string) => void;
    onSkip?: (id: string) => void;
    isCompact?: boolean;
    nextCongestion?: 'low' | 'moderate' | 'high';
    onTimeChange?: (id: string, newTime: string) => void;
    onBufferChange?: (id: string, newBuffer: number) => void;
}

export function TimelineItem({ event, isLast, isFirst, isCompact = false, icon, onClick, onCheckIn, onSkip, nextCongestion, onTimeChange, onBufferChange }: TimelineItemProps) {
    const [showTimePicker, setShowTimePicker] = useState(false);
    const showTravelTime = !!event.travelTime && !isCompact;
    const isSkipped = event.status === 'Skipped';
    const isCheckedIn = event.status === 'Checked In';
    const showStartBadge = isFirst;

    // Traffic Coloring Logic
    let connectorColor = 'bg-blue-200'; // Default line color
    let badgeBorderColor = 'border-zinc-200';
    let badgeTextColor = 'text-zinc-500';
    let badgeBgColor = 'bg-zinc-100';

    // Outgoing color for the next segment
    let outgoingConnectorColor = 'bg-blue-200';
    if (nextCongestion === 'high') outgoingConnectorColor = 'bg-red-500';
    else if (nextCongestion === 'moderate') outgoingConnectorColor = 'bg-amber-400';
    else if (nextCongestion === 'low') outgoingConnectorColor = 'bg-emerald-400';

    if (showTravelTime) {
        if (event.congestion === 'high') {
            connectorColor = 'bg-red-500';
            badgeBorderColor = 'border-red-200';
            badgeTextColor = 'text-red-600';
            badgeBgColor = 'bg-red-50';
        } else if (event.congestion === 'moderate') {
            connectorColor = 'bg-amber-400';
            badgeBorderColor = 'border-amber-200';
            badgeTextColor = 'text-amber-600';
            badgeBgColor = 'bg-amber-50';
        } else if (event.congestion === 'low') {
            connectorColor = 'bg-emerald-400'; // Explicit Green for good traffic
            badgeBorderColor = 'border-emerald-200';
            badgeTextColor = 'text-emerald-600';
            badgeBgColor = 'bg-emerald-50';
        } else {
            // Default if no congestion info but has travel time (shouldn't happen with new API)
            // connectorColor = 'bg-blue-200'; // Keep default
        }
    }

    // Opening Hours Logic
    const todayHours = getTodayHours(event.openingHours);
    const timeColor = todayHours ? getTimeColor(event.time, todayHours.open, todayHours.close) : 'text-white/90';

    return (
        <div className="flex flex-col items-center relative group pb-4 w-full">

            {/* 1. THE CONTINUOUS SPINE (Z-INDEX 0) */}
            <div className={`absolute top-0 w-[5px] left-1/2 -translate-x-1/2 ${showStartBadge ? 'bg-blue-200' : connectorColor} transition-colors duration-500 z-0`}
                style={{ height: (showTravelTime || showStartBadge) ? '64px' : '0px' }} />

            {!isLast && (
                <div className={`absolute bottom-0 w-[5px] left-1/2 -translate-x-1/2 ${outgoingConnectorColor} transition-colors duration-500 z-0`}
                    style={{ top: (showTravelTime || showStartBadge) ? '64px' : '0px' }} />
            )}

            {/* 2. TRAVEL INFO SEGMENT (Now much more compact) */}
            {(showTravelTime || showStartBadge) && (
                <div className="h-16 w-full flex items-center justify-center relative z-10">
                    <div className={`absolute inset-0 flex items-center justify-center ${showStartBadge ? 'items-start pt-2' : ''} ${isSkipped ? 'opacity-30' : ''}`}>
                        {showStartBadge ? (
                            <div className="flex items-center justify-center relative z-30 group/start">
                                <div className="bg-white border-2 border-blue-200 rounded-full flex items-center shadow-xl z-20 overflow-hidden">
                                    {/* Area 1: Time Setting (Click to open picker) */}
                                    <div className="relative flex items-center gap-2 pl-4 pr-3 py-1.5 border-r border-blue-100 hover:bg-blue-50 transition-colors active:bg-blue-100 cursor-pointer"
                                        onClick={() => setShowTimePicker(true)}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)] animate-pulse" />
                                        <span className="text-[12px] text-[#007AFF] font-black uppercase tracking-widest flex items-center gap-1.5">
                                            {event.time}
                                            <Pencil size={10} className="opacity-40" />
                                        </span>
                                        <AnimatePresence>
                                            {showTimePicker && (
                                                <TimePicker
                                                    initialTime={event.time}
                                                    onSave={(newTime) => {
                                                        onTimeChange?.(event.id, newTime);
                                                        setShowTimePicker(false);
                                                    }}
                                                    onClose={() => setShowTimePicker(false)}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Area 2: 'Now' Button (Instant update) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const now = new Date();
                                            const hhmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                                            onTimeChange?.(event.id, hhmm);
                                        }}
                                        className="flex items-center gap-1.5 text-[#007AFF] hover:bg-blue-50 px-4 py-1.5 transition-colors active:bg-blue-100 h-full"
                                    >
                                        <Timer size={13} strokeWidth={2.5} />
                                        <span className="text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">Now</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`${badgeBgColor} border-2 ${badgeBorderColor} rounded-full px-5 py-2 flex items-center gap-2.5 shadow-xl whitespace-nowrap transition-all duration-500 z-20 hover:scale-105 backdrop-blur-sm`}>
                                <span className={`text-[11px] ${badgeTextColor} font-black uppercase tracking-widest flex items-center gap-2.5`}>
                                    <Clock size={14} strokeWidth={3} className={badgeTextColor} />
                                    {event.travelTime}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. THE CONTENT CARD (POI Icon removed to save space) */}
            <div className={`w-full max-w-[500px] px-2 relative z-10 transition-all duration-300 ${isSkipped ? 'opacity-50' : ''}`}>

                {/* Custom Flight Ticket UI */}
                {event.id === '1' && event.type === 'Transport' ? (
                    <div className="rounded-[1.75rem] overflow-hidden shadow-2xl shadow-blue-900/20 mb-2 group/card cursor-pointer transition-transform hover:scale-[1.01]" onClick={onClick}>
                        {/* Top Section - Dark Navy */}
                        <div className="bg-[#0B1221] p-6 relative">
                            {/* Flight Path Visual */}
                            <div className="flex justify-between items-start text-white relative z-10">
                                <div className="text-left">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex items-center bg-white/5 backdrop-blur-md rounded-full border border-white/10 overflow-hidden shadow-sm">
                                            <span className="text-[10px] font-bold text-slate-300 px-2.5 py-1 border-r border-white/5">
                                                {event.time}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentBuffer = event.parkingBuffer ?? 10;
                                                    const nextBuffer = currentBuffer >= 30 ? 0 : currentBuffer + 10;
                                                    onBufferChange?.(event.id, nextBuffer);
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] text-slate-400 hover:bg-white/5 hover:text-[#007AFF] transition-all font-bold group/park"
                                                title="Adjust airport buffer/parking time"
                                            >
                                                <Car size={10} className="text-[#007AFF] opacity-70 group-hover/park:opacity-100" />
                                                <span>
                                                    {event.parkingBuffer ?? 10} {(event.parkingBuffer ?? 10) === 1 ? 'min' : 'mins'} parking
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold tracking-wider mb-1">CGK</div>
                                    <div className="text-xs text-slate-400 font-medium">Jakarta</div>
                                </div>

                                <div className="flex-grow mx-4 relative h-12 flex flex-col items-center justify-center">
                                    {/* Dashed Arch - using SVG for better curve control or simple border radius */}
                                    <div className="absolute top-3 w-full h-8 border-t-2 border-dashed border-slate-600 rounded-[50%] opacity-30" style={{ transform: 'scaleY(0.5)' }}></div>
                                    <Plane size={16} className="text-slate-400 rotate-90 absolute -top-0.5" fill="currentColor" />
                                    <span className="text-[10px] text-slate-500 font-bold mt-5">{event.description?.match(/(\d+h \d+m)/)?.[0] || '2h 15m'}</span>
                                </div>

                                <div className="text-right">
                                    <div className="text-xs text-slate-400 font-bold mb-1 opacity-80">{event.endTime || '11:15'}</div>
                                    <div className="text-3xl font-bold tracking-wider mb-1">DPS</div>
                                    <div className="text-xs text-slate-400 font-medium">Bali</div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section - Bright Blue */}
                        <div className="bg-[#007AFF] p-5 flex justify-between items-center text-white relative">
                            {/* Decorative Cutouts */}
                            <div className="absolute -top-3 -left-3 w-6 h-6 bg-zinc-50 rounded-full" />
                            <div className="absolute -top-3 -right-3 w-6 h-6 bg-zinc-50 rounded-full" />

                            <div>
                                <div className="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-0.5">Flight number</div>
                                <div className="text-lg font-bold tracking-wide">AK 5798</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-0.5">Gate no.</div>
                                <div className="text-lg font-bold tracking-wide">B2</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-0.5">Seat no.</div>
                                <div className="text-lg font-bold tracking-wide">24F</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Logic flow: isSkipped -> compact -> standard
                    isSkipped ? (
                        <div
                            onClick={onClick}
                            className={`p-6 rounded-[1.75rem] relative group/card cursor-pointer flex flex-col gap-3 
                                bg-zinc-100 border border-zinc-200 opacity-60 grayscale hover:opacity-80 transition-all`}
                        >
                            {/* Single Block Content (Skipped) */}
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-zinc-200/50 rounded-full border border-zinc-300/50 overflow-hidden shadow-sm">
                                        <span className="text-[11px] font-bold text-zinc-400 px-3 py-1 border-r border-zinc-300/30">
                                            {event.time}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentBuffer = event.parkingBuffer ?? 10;
                                                const nextBuffer = currentBuffer >= 30 ? 0 : currentBuffer + 10;
                                                onBufferChange?.(event.id, nextBuffer);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-zinc-400 font-bold hover:bg-zinc-300/50 hover:text-[#007AFF] transition-all"
                                        >
                                            <Car size={10} />
                                            <span>
                                                {event.parkingBuffer ?? 10} {(event.parkingBuffer ?? 10) === 1 ? 'min' : 'mins'} parking
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded-full font-bold border border-zinc-300">Skipped</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-500 mb-1.5 leading-tight line-through decoration-zinc-400">{event.title}</h3>
                                {event.description && <p className="text-sm text-zinc-400 mb-2 leading-relaxed font-medium">{event.description}</p>}
                            </div>

                            {/* Metadata */}
                            {(event.duration || event.rating) && (
                                <div className="flex items-center gap-4 text-xs text-zinc-500 font-bold">
                                    {event.rating && (
                                        <div className="flex items-center gap-1 text-[#007AFF]">
                                            <Star size={14} fill="currentColor" />
                                            <span className="text-zinc-200">{event.rating}</span>
                                            <span className="text-zinc-500 font-medium">({event.reviews})</span>
                                        </div>
                                    )}
                                    {event.duration && (
                                        <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300">
                                            <Clock size={13} />
                                            <span>{event.duration}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Actions Footer - Simple for these states */}
                            <div className="grid gap-2.5 mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSkip?.(event.id); }}
                                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-all text-xs font-bold w-full shadow-sm"
                                >
                                    <Undo2 size={15} />
                                    Restore Activity
                                </button>
                            </div>
                        </div>
                    ) : (
                        isCompact ? (
                            // Compact Edit Mode
                            <div
                                onClick={onClick}
                                className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-300 transition-all"
                            >
                                <div className="flex items-center bg-zinc-100 rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
                                    <span className="text-xs font-bold text-zinc-500 whitespace-nowrap bg-zinc-100 px-3 py-1.5 border-r border-zinc-200/50 min-w-[3.5rem] text-center">{event.time}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentBuffer = event.parkingBuffer ?? 10;
                                            const nextBuffer = currentBuffer >= 30 ? 0 : currentBuffer + 10;
                                            onBufferChange?.(event.id, nextBuffer);
                                        }}
                                        className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold hover:bg-zinc-200/30 hover:text-[#007AFF] transition-colors px-3 py-1.5 whitespace-nowrap"
                                    >
                                        <Car size={10} />
                                        <span>
                                            {event.parkingBuffer ?? 10} {(event.parkingBuffer ?? 10) === 1 ? 'min' : 'mins'} parking
                                        </span>
                                    </button>
                                </div>
                                <div className="flex-grow min-w-0">
                                    <h3 className="text-sm font-bold text-zinc-900 truncate">{event.title}</h3>
                                    {event.duration && <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1"><Clock size={10} /> {event.duration}</p>}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400">
                                    <div className="scale-75">{icon}</div>
                                </div>
                            </div>
                        ) : (
                            // Standard Expanded Card
                            <div className="rounded-[1.75rem] overflow-hidden shadow-2xl shadow-blue-900/20 mb-2 group/card cursor-pointer transition-transform hover:scale-[1.005] bg-[#0B1221]" onClick={onClick}>
                                {/* Top Section: Dark Navy or Image */}
                                <div className="p-6 pb-6 relative overflow-hidden h-full min-h-[160px] flex flex-col justify-between">
                                    {/* (Normal Card Content) */}
                                    {event.image && (
                                        <>
                                            <div className="absolute inset-0 z-0">
                                                <img
                                                    src={event.image}
                                                    alt={event.title}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1221]/90 via-[#0B1221]/50 to-[#0B1221]/30" />
                                            </div>
                                        </>
                                    )}

                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center bg-[#0B1221]/60 backdrop-blur-md rounded-full border border-white/10 overflow-hidden shadow-lg">
                                                    <span className={`text-sm font-bold ${timeColor} px-3.5 py-1.5 border-r border-white/5`}>{event.time}</span>
                                                    {isFirst ? (
                                                        <div className="flex items-center gap-2 px-3.5 py-1.5 text-white/90">
                                                            <MapPin size={14} className="text-[#007AFF]" />
                                                            <span className="text-sm font-bold">Start</span>
                                                        </div>
                                                    ) : event.isEnd ? (
                                                        <div className="flex items-center gap-2 px-3.5 py-1.5 text-white/90">
                                                            <MapPin size={14} className="text-red-400" />
                                                            <span className="text-sm font-bold">End</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const currentBuffer = event.parkingBuffer ?? 10;
                                                                const nextBuffer = currentBuffer >= 30 ? 0 : currentBuffer + 10;
                                                                onBufferChange?.(event.id, nextBuffer);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white transition-all group/park"
                                                            title="Adjust parking/buffer time"
                                                        >
                                                            <Car size={13} className="text-[#007AFF] opacity-80 group-hover/park:opacity-100 transition-opacity" />
                                                            <span className="text-[11px] font-bold">
                                                                {event.parkingBuffer ?? 10} {(event.parkingBuffer ?? 10) === 1 ? 'min' : 'mins'} parking
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {event.status && event.status !== 'Scheduled' && (
                                                <span className="text-[10px] text-zinc-400 bg-zinc-800/50 px-2.5 py-1 rounded-full font-bold border border-zinc-700/50 backdrop-blur-md">{event.status}</span>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-2 leading-tight tracking-wide drop-shadow-md">{event.title}</h3>
                                        {event.description && <p className="text-sm text-slate-200/80 mb-4 leading-relaxed font-medium line-clamp-2 drop-shadow-sm">{event.description}</p>}

                                        {(event.duration || event.rating || event.openingHours) && (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-4 text-xs text-slate-300 font-bold">
                                                    {event.rating && (
                                                        <div className="flex items-center gap-1 text-[#007AFF] bg-[#0B1221]/40 px-2 py-1 rounded-lg backdrop-blur-md border border-white/5">
                                                            <Star size={14} fill="currentColor" />
                                                            <span className="text-slate-100">{event.rating}</span>
                                                            <span className="text-slate-400 font-medium">({event.reviews})</span>
                                                        </div>
                                                    )}
                                                    {event.duration && (
                                                        <div className="flex items-center gap-1.5 bg-[#0B1221]/40 px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 shadow-sm backdrop-blur-md">
                                                            <Clock size={13} className="text-[#007AFF]" />
                                                            <span>{event.duration}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Opening Hours Display */}
                                                {event.openingHours && getTodayHours(event.openingHours) && (
                                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 opacity-80 pl-0.5">
                                                        <span className={getTimeColor(event.time, getTodayHours(event.openingHours)!.open, getTodayHours(event.openingHours)!.close)}>
                                                            {getTodayHours(event.openingHours)!.text}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Section: Bright Blue */}
                                <div className="bg-[#007AFF] p-4 relative">
                                    {/* Decorative Cutouts */}
                                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-zinc-50 rounded-full" />
                                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-zinc-50 rounded-full" />

                                    <div className="grid gap-2.5">
                                        <Link to={`/place/${event.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center justify-between bg-white text-[#007AFF] text-xs font-bold py-3 px-5 rounded-xl transition-all hover:bg-white/90 hover:scale-[1.01] shadow-sm w-full"
                                        >
                                            <span>View Details</span>
                                            <ArrowRight size={14} className="opacity-70" />
                                        </Link>

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCheckIn?.(event.id); }}
                                                className={`
                                                flex items-center justify-center gap-2 py-3 px-3 rounded-xl transition-all text-xs font-bold border
                                                ${isCheckedIn
                                                        ? 'bg-white text-[#007AFF] border-white shadow-md'
                                                        : 'bg-[#005EC2] text-white/90 border-white/10 hover:bg-[#0051A8] hover:text-white'}
                                            `}
                                            >
                                                <CheckCircle2 size={15} className={isCheckedIn ? 'fill-[#007AFF] text-white' : ''} />
                                                {isCheckedIn ? 'Checked In' : 'Check In'}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSkip?.(event.id); }}
                                                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#005EC2] text-blue-200 border border-white/10 hover:bg-[#0051A8] hover:text-white transition-all text-xs font-bold"
                                            >
                                                <XCircle size={15} />
                                                Skip
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )
                )}
            </div>
        </div>
    );
}
