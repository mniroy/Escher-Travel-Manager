
import { Layout } from '../components/Layout';
import { FileText, Plus, Tag, Upload, X, Check, Search, Trash2, Sparkles, Download, MapPin, Plane } from 'lucide-react'; // Added Trash2, Sparkles, Download, MapPin, Plane
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTrip } from '../context/TripContext';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase'; // Import supabase

type DocCategory = 'Transport' | 'Accommodation' | 'Identity' | 'Finance' | 'Other';

interface DocumentItem {
    id: string;
    title: string;
    date: string;
    size: string;
    category: DocCategory; // Added category
    fileUrl?: string; // Added fileUrl
    metadata?: any; // AI Extracted info
}

// Light mode colors
const CATEGORY_COLORS: Record<DocCategory, { iconBg: string, iconColor: string, tagBg: string, tagText: string }> = {
    'Transport': { iconBg: 'bg-blue-50', iconColor: 'text-blue-600', tagBg: 'bg-blue-50', tagText: 'text-blue-600' },
    'Accommodation': { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', tagBg: 'bg-emerald-50', tagText: 'text-emerald-600' },
    'Identity': { iconBg: 'bg-purple-50', iconColor: 'text-purple-600', tagBg: 'bg-purple-50', tagText: 'text-purple-600' },
    'Finance': { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', tagBg: 'bg-amber-50', tagText: 'text-amber-600' },
    'Other': { iconBg: 'bg-zinc-100', iconColor: 'text-zinc-500', tagBg: 'bg-zinc-100', tagText: 'text-zinc-500' }
};

export default function DocumentsPage() {
    const { currentTripId, refreshData } = useTrip();
    const [sortMode, setSortMode] = useState<'date' | 'category'>('date');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [localDocs, setLocalDocs] = useState<DocumentItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { scrollY } = useScroll();
    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    // Fetch documents on load
    useEffect(() => {
        if (!currentTripId) return;

        console.log('Fetching documents for trip:', currentTripId);
        fetch(`/api/documents?tripId=${currentTripId}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const formatted = data.map((d: any) => ({
                        id: d.id,
                        title: d.title,
                        date: new Date(d.created_at).toLocaleDateString(),
                        size: d.size || '?',
                        category: d.category,
                        fileUrl: d.file_url,
                        metadata: d.metadata
                    }));
                    setLocalDocs(formatted);
                } else {
                    console.error('API returned non-array:', data);
                }
            })
            .catch(err => console.error('Failed to fetch docs:', err));
    }, [currentTripId]);

    const filteredDocs = useMemo(() => {
        let docs = [...localDocs];

        if (searchQuery) {
            const result = searchQuery.toLowerCase();
            docs = docs.filter(d => d.title.toLowerCase().includes(result));
        }

        if (sortMode === 'category') {
            docs.sort((a, b) => a.category.localeCompare(b.category));
        } else {
            // Default to date sort (newest first)
            // Assuming date string is parseable, or we can use id if chronological
            docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return docs;
    }, [localDocs, sortMode, searchQuery]);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const submitUpload = async () => {
        if (!selectedFile || !currentTripId) return;

        setIsUploading(true);
        try {
            // 1. Upload to Supabase Storage
            const fileName = `${currentTripId}/${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`; // Sanitize filename
            const { error: uploadError } = await supabase.storage
                .from('trip_docs')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('trip_docs')
                .getPublicUrl(fileName);

            // 2. Call API to Analyze & Save DB Record
            const res = await fetch('/api/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tripId: currentTripId,
                    fileUrl: publicUrl,
                    fileName: selectedFile.name,
                    fileType: selectedFile.type
                })
            });

            if (!res.ok) throw new Error('Processing failed');

            const result = await res.json();
            const newDoc = result.document;

            // 3. Update UI
            setLocalDocs(prev => [{
                id: newDoc.id,
                title: newDoc.title,
                date: new Date().toLocaleDateString(),
                size: `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`,
                category: newDoc.category,
                fileUrl: newDoc.file_url,
                metadata: newDoc.metadata
            }, ...prev]);

            if (result.analysis?.autoCreatedEvent) {
                setToastMessage(`Saved ${result.analysis.title} & created itinerary card!`);
                // Force global refresh to show the new event in Itinerary immediately
                refreshData();
            } else {
                setToastMessage(`Uploaded ${result.analysis?.title || selectedFile.name}`);
            }
            setTimeout(() => setToastMessage(null), 4000);

            // Allow another upload
            setSelectedFile(null);
            setIsUploadOpen(false);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        }
    };

    const handleDelete = async (docId: string, fileUrl?: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation(); // Prevent opening document when clicking delete

        if (!confirm('Delete this document?')) return;

        // Optimistic UI update
        const prevDocs = [...localDocs];
        setLocalDocs(prev => prev.filter(d => d.id !== docId));

        try {
            const res = await fetch('/api/delete-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: docId, fileUrl })
            });
            if (!res.ok) throw new Error('Delete API failed');
            setToastMessage('Document deleted');
            setTimeout(() => setToastMessage(null), 2000);
        } catch (err) {
            console.error('Delete failed', err);
            setLocalDocs(prevDocs); // Revert
            alert('Failed to delete document');
        }
    };

    const handleOpenDocument = (url?: string) => {
        if (url) window.open(url, '_blank');
    };

    const handleDownloadDocument = async (url?: string, filename?: string) => {
        if (!url) return;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank'); // Fallback
        }
    };

    return (
        <Layout>
            <div className="min-h-screen bg-zinc-50 pb-24">

                {/* Parallax Header */}
                <div className="h-[280px] w-full fixed top-0 left-0 right-0 z-0 overflow-hidden bg-zinc-900">
                    <motion.div style={{ y: bgY, opacity: bgOpacity }} className="absolute inset-0">
                        <img
                            src="https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=2000&q=80"
                            className="w-full h-full object-cover opacity-60"
                            alt="Documents Background"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                    </motion.div>

                    <div className="absolute bottom-16 left-6 z-20">
                        <h1 className="text-4xl font-['Playfair_Display'] font-black text-white mb-2 shadow-sm drop-shadow-md">Travel Docs</h1>
                        <p className="text-white/90 text-sm font-medium drop-shadow-sm max-w-xs">Everything you need, organized and offline-ready.</p>
                    </div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 mt-[260px]">
                    <div className="bg-zinc-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-screen pt-2">

                        {/* Sticky Search & Actions */}
                        <div className="sticky top-0 z-40 bg-zinc-50/95 backdrop-blur-md pt-6 pb-4 px-6 rounded-t-[2.5rem] border-b border-zinc-100">
                            <div className="flex gap-2 mb-4">
                                <div className="relative flex-grow shadow-sm">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search documents..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all text-zinc-800 placeholder:text-zinc-400"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsUploadOpen(true)}
                                    className="bg-black text-white px-4 rounded-xl flex items-center justify-center shadow-lg hover:bg-zinc-800 active:scale-95 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSortMode('date')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${sortMode === 'date' ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                >
                                    Recent
                                </button>
                                <button
                                    onClick={() => setSortMode('category')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${sortMode === 'category' ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                >
                                    <Tag size={12} />
                                    Group by Category
                                </button>
                            </div>
                        </div>

                        {/* Document List */}
                        <div className="px-6 pb-24 space-y-3 mt-4">
                            <AnimatePresence>
                                {filteredDocs.map((doc, index) => {
                                    const showHeader = sortMode === 'category' && (index === 0 || filteredDocs[index - 1].category !== doc.category);
                                    const colors = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS['Other'];

                                    return (
                                        <div key={doc.id}>
                                            {showHeader && (
                                                <motion.h3
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-widest mt-6 mb-2 px-1"
                                                >
                                                    {doc.category}
                                                </motion.h3>
                                            )}
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={() => handleOpenDocument(doc.fileUrl)}
                                                className="cursor-pointer group active:scale-[0.99] relative overflow-hidden"
                                            >
                                                {doc.metadata?.flightDetails ? (
                                                    /* flight card code (keep existing) */
                                                    <div className="flex flex-col rounded-[32px] overflow-hidden shadow-2xl shadow-blue-900/30 border border-white/10 group-hover:scale-[1.01] transition-all duration-500">
                                                        {/* Ticket Header (Passengers & Booking Code) */}
                                                        <div className="bg-[#050B1A] px-6 py-4 flex justify-between items-center border-b border-white/5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Passengers</span>
                                                                <div className="flex gap-2 flex-wrap">
                                                                    {(doc.metadata.flightDetails.passengers || []).length > 0 ? (
                                                                        doc.metadata.flightDetails.passengers.map((p: string, i: number) => (
                                                                            <span key={i} className="text-[11px] font-bold text-white/80">{p}{i < doc.metadata.flightDetails.passengers.length - 1 ? ',' : ''}</span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-[11px] font-bold text-white/40 italic">Not specified</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Booking Code</span>
                                                                <p className="text-sm font-black text-white tracking-widest leading-none">{doc.metadata.flightDetails.bookingCode || 'TBD'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Flight Legs */}
                                                        {(doc.metadata.flightDetails.flights || [doc.metadata.flightDetails]).map((flight: any, idx: number) => (
                                                            <div key={idx} className={`${idx > 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                                                                {/* Top Section (Dark/Navy) */}
                                                                <div className="bg-[#0A1633] p-6 text-white relative">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2 opacity-80 mb-2">
                                                                                <Plane size={12} className="rotate-90 text-blue-400" />
                                                                                <span className="text-sm font-black uppercase tracking-wider">
                                                                                    {flight.departureTime}
                                                                                    {flight.departureTimeZone && <span className="ml-1 opacity-50 text-[10px]">{flight.departureTimeZone}</span>}
                                                                                </span>
                                                                            </div>
                                                                            <h2 className="text-4xl font-black tracking-tighter leading-none">{flight.originCode}</h2>
                                                                            <p className="text-[11px] font-medium opacity-50 mt-1">{flight.originCity}</p>
                                                                        </div>

                                                                        {/* Duration Centerpiece */}
                                                                        <div className="flex-1 flex flex-col items-center justify-center px-4 relative mt-4">
                                                                            <div className="bg-[#0A1633] px-3 z-10 mb-1">
                                                                                <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{flight.date}</span>
                                                                            </div>
                                                                            <div className="w-full h-[1px] bg-white/10 absolute top-1/2 left-0" />
                                                                            <div className="bg-[#0A1633] px-3 z-10">
                                                                                <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest whitespace-nowrap">{flight.duration}</span>
                                                                            </div>
                                                                            {/* Curved Visual Line */}
                                                                            <svg className="absolute top-[-20px] w-full h-12 pointer-events-none opacity-20" viewBox="0 0 100 20">
                                                                                <path d="M 0 20 Q 50 0 100 20" fill="none" stroke="currentColor" strokeWidth="1" />
                                                                            </svg>
                                                                        </div>

                                                                        <div className="flex flex-col items-end">
                                                                            <div className="flex items-center gap-2 opacity-80 mb-2">
                                                                                <span className="text-sm font-black uppercase tracking-wider">
                                                                                    {flight.arrivalTime}
                                                                                    {flight.arrivalTimeTimeZone && <span className="ml-1 opacity-50 text-[10px]">{flight.arrivalTimeTimeZone}</span>}
                                                                                </span>
                                                                                <Plane size={12} className="rotate-180 text-blue-400" />
                                                                            </div>
                                                                            <h2 className="text-4xl font-black tracking-tighter leading-none text-right">{flight.destinationCode}</h2>
                                                                            <p className="text-[11px] font-medium opacity-50 mt-1 text-right">{flight.destinationCity}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Bottom Section (Premium Blue) */}
                                                                <div className="bg-[#007AFF] px-6 py-5 text-white grid grid-cols-3 gap-4 border-t border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                                                                    <div className="flex flex-col">
                                                                        <h3 className="text-lg font-black leading-none mb-1">{flight.flightNumber}</h3>
                                                                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Flight number</p>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <h3 className="text-lg font-black leading-none mb-1">{flight.gate || 'TBD'}</h3>
                                                                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Gate no.</p>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <h3 className="text-lg font-black leading-none mb-1">{flight.seat || 'TBD'}</h3>
                                                                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Seat no.</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : doc.metadata?.accommodationDetails ? (
                                                    /* New Premium Accommodation Card (Hotel Key Card Style) */
                                                    <div className="flex flex-col rounded-[24px] overflow-hidden shadow-2xl shadow-emerald-900/20 border border-white/10 group-hover:scale-[1.01] transition-all duration-500 bg-[#064E3B] text-white h-auto min-h-[220px] relative">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                                                        {/* Hotel Header */}
                                                        <div className="p-6 relative z-10 flex-grow">
                                                            <div className="flex justify-between items-start mb-8">
                                                                <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl">
                                                                    <MapPin className="text-emerald-300" size={20} />
                                                                </div>
                                                                <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest text-emerald-100 backdrop-blur-sm">
                                                                    Booking Ref: {doc.metadata.accommodationDetails.bookingReference || 'N/A'}
                                                                </span>
                                                            </div>

                                                            <h2 className="text-3xl font-['Playfair_Display'] font-black leading-tight mb-2 tracking-tight">
                                                                {doc.metadata.accommodationDetails.hotelName}
                                                            </h2>
                                                            <p className="text-sm font-medium text-emerald-200/80 line-clamp-2 mb-6">
                                                                {doc.metadata.accommodationDetails.address}
                                                            </p>

                                                            {/* Check-in / Out Grid */}
                                                            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-widest text-emerald-300/60 font-bold mb-1">Check-In</p>
                                                                    <h3 className="text-lg font-black">{doc.metadata.accommodationDetails.checkInDate}</h3>
                                                                    <p className="text-xs font-medium text-white/60">{doc.metadata.accommodationDetails.checkInTime}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] uppercase tracking-widest text-emerald-300/60 font-bold mb-1">Check-Out</p>
                                                                    <h3 className="text-lg font-black">{doc.metadata.accommodationDetails.checkOutDate}</h3>
                                                                    <p className="text-xs font-medium text-white/60">{doc.metadata.accommodationDetails.checkOutTime}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Guest Strip */}
                                                        <div className="bg-[#065F46] px-6 py-3 flex justify-between items-center text-xs font-medium text-emerald-100 border-t border-white/5">
                                                            <span>Guest: <span className="text-white font-bold">{doc.metadata.accommodationDetails.guestName || 'Guest'}</span></span>
                                                            <span>{doc.metadata.accommodationDetails.roomType}</span>
                                                        </div>
                                                    </div>
                                                ) : doc.metadata?.activityDetails ? (
                                                    /* New Premium Activity Card (Event Ticket Style) */
                                                    <div className="relative flex rounded-[24px] overflow-hidden shadow-2xl shadow-purple-900/20 group-hover:scale-[1.01] transition-all duration-500 bg-white">
                                                        {/* Main Ticket Section */}
                                                        <div className="bg-[#1e1b4b] flex-grow p-6 text-white relative flex flex-col justify-between">
                                                            <div>
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-900/50 px-2 py-1 rounded-md">Event Ticket</span>
                                                                    <Download size={16} className="text-purple-300/50" />
                                                                </div>
                                                                <h2 className="text-2xl font-black leading-none mb-2 tracking-tight">{doc.metadata.activityDetails.eventName}</h2>
                                                                <p className="text-sm text-purple-200/60 font-medium flex items-center gap-1.5">
                                                                    <MapPin size={12} /> {doc.metadata.activityDetails.venue}
                                                                </p>
                                                            </div>

                                                            <div className="mt-8 flex gap-8">
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-0.5">Date</p>
                                                                    <p className="text-lg font-black">{doc.metadata.activityDetails.date}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-0.5">Time</p>
                                                                    <p className="text-lg font-black">{doc.metadata.activityDetails.time}</p>
                                                                </div>
                                                                {doc.metadata.activityDetails.seat && (
                                                                    <div>
                                                                        <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-0.5">Seat</p>
                                                                        <p className="text-lg font-black">{doc.metadata.activityDetails.seat}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Tear-off Stub Visual */}
                                                        <div className="relative w-12 bg-[#312e81] border-l-2 border-dashed border-white/20 flex flex-col items-center justify-center">
                                                            <div className="absolute -top-3 left-[-9px] w-5 h-5 rounded-full bg-zinc-50 z-10"></div>
                                                            <div className="absolute -bottom-3 left-[-9px] w-5 h-5 rounded-full bg-zinc-50 z-10"></div>

                                                            <div className="rotate-90 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-purple-300/50">
                                                                ADMIT ONE
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : doc.metadata?.transportDetails ? (
                                                    /* New Ground Transport Card (Metro/Train Pass Style) */
                                                    <div className="rounded-[20px] overflow-hidden shadow-xl shadow-orange-900/10 group-hover:scale-[1.01] transition-all duration-500 bg-zinc-900 border border-zinc-800 relative">
                                                        {/* Orange Stripe Top */}
                                                        <div className="h-2 w-full bg-[#EA580C]"></div>

                                                        <div className="p-6">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="bg-white/10 p-1.5 rounded-lg">
                                                                        {/* We can use a generalized 'Train' icon or similar */}
                                                                        <span className="font-black text-white text-xs px-1">{doc.metadata.transportDetails.type}</span>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-white/50">{doc.metadata.transportDetails.provider}</span>
                                                                </div>
                                                                <span className="text-xs font-mono text-[#EA580C] bg-[#EA580C]/10 px-2 py-1 rounded font-bold">
                                                                    ID: {doc.metadata.transportDetails.bookingReference || '---'}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center justify-between mb-2">
                                                                <div>
                                                                    <h3 className="text-2xl font-black text-white">{doc.metadata.transportDetails.origin}</h3>
                                                                    <p className="text-xs text-white/40 font-bold uppercase tracking-wider">{doc.metadata.transportDetails.departureTime}</p>
                                                                </div>

                                                                <div className="flex-1 px-4 flex flex-col items-center">
                                                                    <div className="w-full h-0.5 bg-white/20 relative">
                                                                        <div className="absolute center-0 -top-1 w-2 h-2 rounded-full bg-white/20"></div>
                                                                        <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-[#EA580C]"></div>
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-white/30 mt-1 uppercase tracking-wider">{doc.metadata.transportDetails.duration}</span>
                                                                </div>

                                                                <div className="text-right">
                                                                    <h3 className="text-2xl font-black text-white">{doc.metadata.transportDetails.destination}</h3>
                                                                    <p className="text-xs text-white/40 font-bold uppercase tracking-wider">{doc.metadata.transportDetails.arrivalTime}</p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 pt-4 border-t border-white/5 flex gap-4 text-xs font-medium text-white/60">
                                                                <span>{doc.metadata.transportDetails.date}</span>
                                                                {doc.metadata.transportDetails.seat && (
                                                                    <span className="text-white">Seat: {doc.metadata.transportDetails.seat}</span>
                                                                )}
                                                                {doc.metadata.transportDetails.class && (
                                                                    <span className="ml-auto text-[#EA580C]">{doc.metadata.transportDetails.class}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : doc.metadata?.noteDetails ? (
                                                    /* New Note Card (Sticky Note Style) */
                                                    <div className="bg-[#FEF9C3] rounded-2xl p-6 shadow-lg shadow-yellow-500/10 rotate-1 group-hover:rotate-0 transition-transform duration-300 relative border border-yellow-200/50">
                                                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-black/5 to-transparent rounded-bl-xl"></div>

                                                        <h3 className="text-lg font-['Playfair_Display'] font-black text-yellow-900 mb-2 leading-tight">
                                                            {doc.title}
                                                        </h3>
                                                        <p className="text-sm text-yellow-800/80 font-medium mb-4 leading-relaxed">
                                                            {doc.metadata.noteDetails.summary}
                                                        </p>

                                                        {(doc.metadata.noteDetails.keyPoints || []).length > 0 && (
                                                            <div className="space-y-2">
                                                                {doc.metadata.noteDetails.keyPoints.map((point: string, i: number) => (
                                                                    <div key={i} className="flex items-start gap-2 text-xs text-yellow-900">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0"></div>
                                                                        <span>{point}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* Standard Card and Original Content */
                                                    <div className="bg-white border border-zinc-100 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-xl hover:shadow-zinc-200/50 hover:border-blue-200 transition-all">
                                                        {doc.metadata && (
                                                            <div className="absolute top-0 right-0">
                                                                <div className="bg-blue-500 text-white p-1.5 rounded-bl-2xl shadow-sm">
                                                                    <Sparkles size={12} />
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors.iconBg} ${colors.iconColor} shadow-sm border border-white/50`}>
                                                                <FileText size={24} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-transparent shadow-sm ${colors.tagBg} ${colors.tagText}`}>
                                                                        {doc.category}
                                                                    </span>
                                                                    <span className="text-[10px] text-zinc-400 font-bold">{doc.size}</span>
                                                                </div>
                                                                <h3 className="font-black text-zinc-900 truncate group-hover:text-[#007AFF] transition-colors text-base">{doc.title}</h3>
                                                            </div>
                                                        </div>

                                                        {/* AI Extracted Info Card Section */}
                                                        {doc.metadata && (
                                                            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex flex-col gap-2.5">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                                                        <Sparkles size={10} className="text-blue-500" />
                                                                        AI Extracted Info
                                                                    </span>
                                                                    {doc.metadata.time && (
                                                                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-lg border border-zinc-100 text-zinc-600 shadow-sm">
                                                                            {doc.metadata.time}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <p className="text-xs font-bold text-zinc-800 leading-snug">
                                                                        {doc.metadata.title}
                                                                    </p>
                                                                    {doc.metadata.description && (
                                                                        <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                                                                            "{doc.metadata.description}"
                                                                        </p>
                                                                    )}
                                                                    {doc.metadata.address && (
                                                                        <div className="flex items-start gap-1.5 mt-1">
                                                                            <MapPin size={10} className="text-zinc-400 mt-0.5 shrink-0" />
                                                                            <p className="text-[10px] text-zinc-400 font-medium leading-tight line-clamp-1">
                                                                                {doc.metadata.address}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer Actions (Applies to both) */}
                                                <div className="flex items-center justify-between pt-1 px-1">
                                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{doc.date}</span>
                                                    <div className="flex gap-2">
                                                        {/* Download Button */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadDocument(doc.fileUrl, doc.title); }}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-50 text-zinc-500 hover:bg-[#007AFF] hover:text-white transition-all shadow-sm active:scale-95"
                                                            title="Download document"
                                                        >
                                                            <Download size={16} />
                                                        </button>

                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={(e) => handleDelete(doc.id, doc.fileUrl, e)}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-50 text-zinc-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                                                            title="Delete document"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    );
                                })}
                            </AnimatePresence>

                            {!localDocs.length && !isUploading && (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                                        <FileText className="text-zinc-300" size={24} />
                                    </div>
                                    <p className="text-zinc-500 font-medium text-sm">No documents yet</p>
                                    <p className="text-zinc-400 text-xs mt-1">Upload files to keep them safe</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Modal Overlay */}
            <AnimatePresence>
                {isUploadOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => !isUploading && (setIsUploadOpen(false), setSelectedFile(null))}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative z-10 overflow-hidden"
                        >
                            <button
                                onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }}
                                disabled={isUploading}
                                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center justify-center text-center py-8">
                                <div className={`w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-[#007AFF] mb-6 shadow-sm ${isUploading ? 'animate-pulse' : ''}`}>
                                    {isUploading ? <Upload size={32} className="animate-bounce" /> : <Upload size={32} />}
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">
                                    {isUploading ? 'Analyzing...' : 'Upload Document'}
                                </h3>
                                <p className="text-zinc-500 text-sm mb-6 leading-relaxed px-4">
                                    {isUploading ? 'Saving your document...' : (selectedFile ? 'Choose a category for your document.' : "Select a PDF or image.")}
                                </p>

                                <div className="w-full">
                                    {!selectedFile ? (
                                        <>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-bold hover:bg-[#0066CC] transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-3"
                                            >
                                                Select File
                                            </button>
                                            <div className="flex items-center justify-center gap-2 text-zinc-400">
                                                <Sparkles size={14} className="text-blue-400" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Enhanced by Gemini AI</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="font-bold text-sm text-zinc-900 truncate">{selectedFile.name}</p>
                                                    <p className="text-xs text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedFile(null)}
                                                    className="p-2 text-zinc-400 hover:text-red-500"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mb-2">
                                                <Sparkles size={16} className="text-blue-500 mt-0.5" />
                                                <div className="text-left">
                                                    <p className="text-[11px] font-bold text-blue-900 leading-tight">Gemini AI Analysis</p>
                                                    <p className="text-[10px] text-blue-700/70 leading-relaxed">We'll automatically categorize and rename your document for better organization.</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={submitUpload}
                                                disabled={isUploading}
                                                className="w-full py-4 mt-2 rounded-xl bg-black text-white font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-70"
                                            >
                                                {isUploading ? 'Analyzing...' : 'Confirm & Analyze'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={onFileSelect}
                                    disabled={isUploading}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Success Toast */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-5 py-3 rounded-full shadow-2xl shadow-zinc-900/40 flex items-center gap-3 z-50 whitespace-nowrap"
                    >
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                            <Check size={12} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold">{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
}
