import { Layout } from '../components/Layout';
import { FileText, Plus, Filter, SortAsc, Tag, Upload, X, Check } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { TimelineEvent } from '../components/TimelineItem';

type DocCategory = 'Transport' | 'Accommodation' | 'Identity' | 'Finance' | 'Other';

interface DocumentItem {
    id: string;
    title: string;
    date: string;
    size: string;
}

const MOCK_DOCS: DocumentItem[] = [
    { id: '1', title: 'Flight Check-in LX180.pdf', date: '2 days ago', size: '1.2 MB' },
    { id: '2', title: 'Hotel Booking - BVLGARI.pdf', date: '5 days ago', size: '840 KB' },
    { id: '3', title: 'Travel Insurance Policy.pdf', date: '1 week ago', size: '2.4 MB' },
    { id: '4', title: 'Passport Copy.jpg', date: '1 month ago', size: '3.1 MB' },
    { id: '5', title: 'Train Ticket to Zurich.pdf', date: 'Yesterday', size: '500 KB' },
    { id: '6', title: 'Visa Approval Letter.pdf', date: '2 weeks ago', size: '150 KB' },
    { id: '7', title: 'Car Rental Agreemnt.pdf', date: '3 days ago', size: '1.1 MB' },
    { id: '8', title: 'Vaccination Certificate.pdf', date: '1 month ago', size: '900 KB' },
];

/**
 * "AI" Logic to determine category based on filename
 */
function determineCategory(title: string): DocCategory {
    const lower = title.toLowerCase();
    if (lower.includes('flight') || lower.includes('ticket') || lower.includes('train') || lower.includes('bus') || lower.includes('car') || lower.includes('transport')) return 'Transport';
    if (lower.includes('hotel') || lower.includes('booking') || lower.includes('bnb') || lower.includes('stay')) return 'Accommodation';
    if (lower.includes('passport') || lower.includes('visa') || lower.includes('id') || lower.includes('license')) return 'Identity';
    if (lower.includes('insurance') || lower.includes('receipt') || lower.includes('invoice') || lower.includes('bill')) return 'Finance';
    return 'Other';
}

const CATEGORY_COLORS: Record<DocCategory, { icon: string, tag: string }> = {
    'Transport': { icon: 'bg-zinc-800 text-blue-200/80', tag: 'bg-zinc-800/50 border-zinc-700 text-zinc-400' },
    'Accommodation': { icon: 'bg-zinc-800 text-emerald-200/80', tag: 'bg-zinc-800/50 border-zinc-700 text-zinc-400' },
    'Identity': { icon: 'bg-zinc-800 text-purple-200/80', tag: 'bg-zinc-800/50 border-zinc-700 text-zinc-400' },
    'Finance': { icon: 'bg-zinc-800 text-amber-200/80', tag: 'bg-zinc-800/50 border-zinc-700 text-zinc-400' },
    'Other': { icon: 'bg-zinc-800 text-zinc-400', tag: 'bg-zinc-800/50 border-zinc-700 text-zinc-400' }
};

export default function DocumentsPage() {
    const { setEvents } = useTrip();
    const [sortMode, setSortMode] = useState<'date' | 'category'>('date');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [localDocs, setLocalDocs] = useState(MOCK_DOCS);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // "AI" Processing of documents
    const processedDocs = useMemo(() => {
        return localDocs.map(doc => ({
            ...doc,
            category: determineCategory(doc.title)
        }));
    }, [localDocs]);

    const sortedDocs = useMemo(() => {
        if (sortMode === 'category') {
            return [...processedDocs].sort((a, b) => a.category.localeCompare(b.category));
        }
        return processedDocs;
    }, [processedDocs, sortMode]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simmsulate upload delay
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

            // "Smart" Processing for Boarding Passes
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
            <div className="p-6 pt-12 pb-24 relative">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 font-display">Documents</h1>
                        <p className="text-zinc-400">Automatically organized.</p>
                    </div>
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                </header>

                {/* Sort Controls */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setSortMode('date')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${sortMode === 'date' ? 'bg-[#007AFF] border-[#007AFF] text-white' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        Recent
                    </button>
                    <button
                        onClick={() => setSortMode('category')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 ${sortMode === 'category' ? 'bg-[#007AFF] border-[#007AFF] text-white' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        <Tag size={14} />
                        Group by Category
                    </button>
                </div>

                <div className="space-y-3">
                    {sortedDocs.map((doc, index) => {
                        // Add header if grouping by category and it's the first of its kind
                        const showHeader = sortMode === 'category' && (index === 0 || sortedDocs[index - 1].category !== doc.category);

                        return (
                            <div key={doc.id}>
                                {showHeader && (
                                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-6 mb-3 px-1">{doc.category}</h3>
                                )}
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-900 transition-colors cursor-pointer group">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[doc.category].icon}`}>
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-semibold text-white group-hover:text-[#007AFF] transition-colors">{doc.title}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${CATEGORY_COLORS[doc.category].tag}`}>{doc.category}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-1">{doc.date} • {doc.size}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Upload Modal Overlay */}
                {isUploadOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center justify-center text-center py-8">
                                <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center text-[#007AFF] mb-4">
                                    <Upload size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Upload Document</h3>
                                <p className="text-zinc-400 text-sm mb-6">Tap below to select a file. We'll verify boardings passes automatically.</p>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-bold hover:bg-[#0066CC] transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    Select File
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success Toast */}
                {toastMessage && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-3 rounded-full shadow-xl border border-zinc-700 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-black">
                            <Check size={12} strokeWidth={4} />
                        </div>
                        <span className="text-sm font-semibold">{toastMessage}</span>
                    </div>
                )}
            </div>
        </Layout>
    );
}
