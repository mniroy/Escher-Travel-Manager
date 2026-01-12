import { Layout } from '../components/Layout';
import { FileText, Plus, Tag, Upload, X, Check, Search, Download } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTrip } from '../context/TripContext';
import { TimelineEvent } from '../components/TimelineItem';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

type DocCategory = 'Transport' | 'Accommodation' | 'Identity' | 'Finance' | 'Other';

interface DocumentItem {
    id: string;
    title: string;
    date: string;
    size: string;
}

const MOCK_DOCS: DocumentItem[] = [];

function determineCategory(title: string): DocCategory {
    const lower = title.toLowerCase();
    if (lower.includes('flight') || lower.includes('ticket') || lower.includes('train') || lower.includes('bus') || lower.includes('car') || lower.includes('transport')) return 'Transport';
    if (lower.includes('hotel') || lower.includes('booking') || lower.includes('bnb') || lower.includes('stay')) return 'Accommodation';
    if (lower.includes('passport') || lower.includes('visa') || lower.includes('id') || lower.includes('license')) return 'Identity';
    if (lower.includes('insurance') || lower.includes('receipt') || lower.includes('invoice') || lower.includes('bill')) return 'Finance';
    return 'Other';
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
    const { setEvents } = useTrip();
    const [sortMode, setSortMode] = useState<'date' | 'category'>('date');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [localDocs, setLocalDocs] = useState(MOCK_DOCS);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { scrollY } = useScroll();
    const bgY = useTransform(scrollY, [0, 500], ['0%', '-15%']);
    const bgOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

    const processedDocs = useMemo(() => {
        return localDocs.map(doc => ({
            ...doc,
            category: determineCategory(doc.title)
        }));
    }, [localDocs]);

    const filteredDocs = useMemo(() => {
        let docs = [...processedDocs];

        if (searchQuery) {
            const result = searchQuery.toLowerCase();
            docs = docs.filter(d => d.title.toLowerCase().includes(result));
        }

        if (sortMode === 'category') {
            docs.sort((a, b) => a.category.localeCompare(b.category));
        }
        return docs;
    }, [processedDocs, sortMode, searchQuery]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setTimeout(() => {
            const newDoc: DocumentItem = {
                id: Date.now().toString(),
                title: file.name,
                date: 'Just now',
                size: `${(file.size / 1024 / 1024).toFixed(1)} MB`
            };

            setLocalDocs(prev => [newDoc, ...prev]);
            setToastMessage(`Uploaded ${file.name}`);
            setTimeout(() => setToastMessage(null), 3000);
            setIsUploadOpen(false);

            if (file.name.toLowerCase().includes('boarding pass')) {
                const newFlightEvent: TimelineEvent = {
                    id: Date.now().toString() + '_flight',
                    type: 'Transport',
                    title: 'Flight from Uploaded Pass',
                    time: '10:00 AM',
                    endTime: '01:00 PM',
                    description: 'Auto-imported from ' + file.name + '. Seat 12A, Gate D4.',
                    dayOffset: 0,
                    duration: '3h',
                    status: 'Scheduled'
                };
                setEvents(prev => [...prev, newFlightEvent]);

                setTimeout(() => {
                    setToastMessage('Flight info added to Itinerary!');
                    setTimeout(() => setToastMessage(null), 4000);
                }, 1000);
            }
        }, 1500);
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
                        <h1 className="text-4xl font-extrabold text-white mb-2 shadow-sm drop-shadow-md">Travel Docs</h1>
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
                                    const colors = CATEGORY_COLORS[doc.category];

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
                                                className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg hover:shadow-zinc-200/50 hover:border-blue-100 transition-all cursor-pointer group active:scale-[0.99]"
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors.iconBg} ${colors.iconColor}`}>
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-zinc-900 truncate group-hover:text-[#007AFF] transition-colors text-sm mb-1">{doc.title}</h3>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-transparent ${colors.tagBg} ${colors.tagText}`}>
                                                            {doc.category}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 font-medium">{doc.date} • {doc.size}</span>
                                                    </div>
                                                </div>
                                                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
                                                    <Download size={14} />
                                                </button>
                                            </motion.div>
                                        </div>
                                    );
                                })}
                            </AnimatePresence>

                            {!localDocs.length && (
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
                            onClick={() => setIsUploadOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative z-10 overflow-hidden"
                        >
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center justify-center text-center py-8">
                                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-[#007AFF] mb-6 shadow-sm">
                                    <Upload size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">Upload Document</h3>
                                <p className="text-zinc-500 text-sm mb-8 leading-relaxed px-4">
                                    Select a PDF or image. We'll automatically categorize it for you.
                                </p>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-bold hover:bg-[#0066CC] transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98]"
                                >
                                    Select File
                                </button>
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
