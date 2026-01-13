
import { Layout } from '../components/Layout';
import { FileText, Plus, Tag, Upload, X, Check, Search, Trash2 } from 'lucide-react'; // Added Trash2
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
    const { currentTripId } = useTrip();
    const [sortMode, setSortMode] = useState<'date' | 'category'>('date');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [localDocs, setLocalDocs] = useState<DocumentItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<DocCategory>('Other');
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
                        fileUrl: d.file_url
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
                    fileType: selectedFile.type,
                    category: selectedCategory // Pass selected category
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
                fileUrl: newDoc.file_url
            }, ...prev]);

            setToastMessage(`Uploaded ${selectedFile.name}`);
            setTimeout(() => setToastMessage(null), 3000);

            // Allow another upload
            setSelectedFile(null);
            setSelectedCategory('Other');
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

                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => handleDelete(doc.id, doc.fileUrl, e)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors z-10"
                                                    title="Delete document"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
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
                                                className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-bold hover:bg-[#0066CC] transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-4"
                                            >
                                                Select File
                                            </button>
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

                                            <div className="text-left">
                                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block ml-1">Select Category</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(Object.keys(CATEGORY_COLORS) as DocCategory[]).map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => setSelectedCategory(cat)}
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${selectedCategory === cat
                                                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-md transform scale-105'
                                                                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                                                                }`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={submitUpload}
                                                disabled={isUploading}
                                                className="w-full py-4 mt-2 rounded-xl bg-black text-white font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-70"
                                            >
                                                {isUploading ? 'Uploading...' : 'Confirm Upload'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
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
