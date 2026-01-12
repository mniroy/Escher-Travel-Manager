import { ArrowRight, Star, Clock, CheckCircle2, XCircle, Undo2, Plane, Footprints, Car } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
}

interface TimelineItemProps {
    event: TimelineEvent;
    isLast?: boolean;
    icon: ReactNode;
    onClick?: () => void;
    onCheckIn?: (id: string) => void;
    onSkip?: (id: string) => void;
}

export function TimelineItem({ event, isLast, icon, onClick, onCheckIn, onSkip }: TimelineItemProps) {
    const hasTravelTime = !!event.travelTime;
    const isSkipped = event.status === 'Skipped';
    const isCheckedIn = event.status === 'Checked In';





    return (
        <div className={`flex gap-4 relative group ${hasTravelTime ? 'mt-16' : ''}`}>

            {/* Timeline Connector */}
            <div className="flex flex-col items-center">
                {/* Connector Line Extension */}
                {hasTravelTime && (
                    <div className="absolute -top-16 h-16 w-[2px] bg-blue-200 left-1/2 -translate-x-1/2" />
                )}

                {/* Travel Time Badge */}
                {hasTravelTime && (
                    <div className={`absolute -top-16 h-16 left-1/2 -translate-x-1/2 flex items-center justify-center z-10 ${isSkipped ? 'opacity-30' : ''}`}>
                        <div className="bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1 flex items-center gap-1 shadow-sm whitespace-nowrap">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide flex items-center gap-1.5">
                                {event.travelMode === 'walk' ? <Footprints size={10} className="text-zinc-500" /> : <Car size={10} className="text-zinc-500" />}
                                {event.travelTime}
                            </span>
                        </div>
                    </div>
                )}

                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center z-10 shrink-0 shadow-sm relative transition-all duration-300 ${isCheckedIn ? 'bg-[#007AFF] border-[#007AFF] text-white' :
                    isSkipped ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-blue-100 text-[#007AFF] shadow-md shadow-blue-500/10'
                    }`}>
                    {icon}
                </div>

                {!isLast && <div className="w-[2px] bg-blue-200 flex-grow my-2 min-h-[40px] rounded-full" />}
            </div>

            {/* Content Card */}
            <div className={`flex-grow pb-8 transition-all duration-300 ${isSkipped ? 'opacity-50' : ''}`}>

                {/* Custom Flight Ticket UI */}
                {event.id === '1' && event.type === 'Transport' ? (
                    <div className="rounded-[1.75rem] overflow-hidden shadow-xl shadow-blue-900/5 mb-2 group/card cursor-pointer transition-transform hover:scale-[1.01]" onClick={onClick}>
                        {/* Top Section - Dark Navy */}
                        <div className="bg-[#0B1221] p-6 relative">
                            {/* Flight Path Visual */}
                            <div className="flex justify-between items-start text-white relative z-10">
                                <div className="text-left">
                                    <div className="text-xs text-slate-400 font-bold mb-1 opacity-80">{event.time}</div>
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
                    // Standard Card Implementation (Skipped Items Only)
                    isSkipped ? (
                        <div
                            onClick={onClick}
                            className={`p-6 rounded-[1.75rem] relative group/card cursor-pointer flex flex-col gap-3 
                                bg-zinc-100 border border-zinc-200 opacity-60 grayscale hover:opacity-80 transition-all`}
                        >
                            {/* Single Block Content (Skipped) */}
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-bold text-zinc-400">
                                    {event.time}
                                </span>
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
                        // Two-Tone Design (Reference: Flight Card)
                        <div className="rounded-[1.75rem] overflow-hidden shadow-xl shadow-blue-900/5 mb-2 group/card cursor-pointer transition-transform hover:scale-[1.005] bg-[#0B1221]" onClick={onClick}>
                            {/* Top Section: Dark Navy or Image */}
                            <div className="p-6 pb-6 relative overflow-hidden h-full min-h-[160px] flex flex-col justify-between">
                                {/* Background Image */}
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
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-sm font-bold text-white/90 drop-shadow-sm bg-[#0B1221]/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">{event.time}</span>
                                        {event.status && event.status !== 'Scheduled' && (
                                            <span className="text-[10px] text-zinc-400 bg-zinc-800/50 px-2.5 py-1 rounded-full font-bold border border-zinc-700/50 backdrop-blur-md">{event.status}</span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2 leading-tight tracking-wide drop-shadow-md">{event.title}</h3>
                                    {event.description && <p className="text-sm text-slate-200/80 mb-4 leading-relaxed font-medium line-clamp-2 drop-shadow-sm">{event.description}</p>}

                                    {(event.duration || event.rating) && (
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
                )}
            </div>
        </div>
    );
}
