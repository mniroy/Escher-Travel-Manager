import { Layout } from '../components/Layout';
import { useTrip } from '../context/TripContext';
import { History, Trash2, Plus, RefreshCcw, MessageSquare, ChevronRight, Calendar, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { format } from 'date-fns';

export default function HistoryPage() {
    const { history, updateHistoryComment, isLoading } = useTrip();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleStartEdit = (id: string, currentComment: string | null) => {
        setEditingId(id);
        setEditValue(currentComment || '');
    };

    const handleSaveComment = async (id: string) => {
        await updateHistoryComment(id, editValue);
        setEditingId(null);
    };

    return (
        <Layout>
            <div className="max-w-2xl mx-auto px-4 pt-8 pb-24">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-lg shadow-zinc-900/20">
                        <History size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Change History</h1>
                        <p className="text-sm text-zinc-500 font-medium">Keep track of your itinerary evolution</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Loading Records...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center shadow-sm">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                            <History size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 mb-1">No history yet</h3>
                        <p className="text-sm text-zinc-400 max-w-xs mx-auto">Changes like deletions will be automatically recorded here with your comments.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline Line */}
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-100 z-0" />

                        <div className="space-y-8 relative z-10">
                            {history.map((record, index) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={record.id}
                                    className="flex gap-6"
                                >
                                    {/* Action Icon Container */}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border-4 border-zinc-50
                                        ${record.action_type === 'delete' ? 'bg-red-50 text-red-500' :
                                            record.action_type === 'add' ? 'bg-emerald-50 text-emerald-500' :
                                                'bg-blue-50 text-blue-500'}
                                    `}>
                                        {record.action_type === 'delete' ? <Trash2 size={20} /> :
                                            record.action_type === 'add' ? <Plus size={20} /> :
                                                <RefreshCcw size={20} />}
                                    </div>

                                    <div className="flex-1 pt-1">
                                        {/* Time Metadata */}
                                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                                            <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-full text-zinc-500">
                                                <Calendar size={10} />
                                                {format(new Date(record.created_at), 'MMM dd')}
                                            </div>
                                            <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-full text-zinc-500">
                                                <Clock size={10} />
                                                {format(new Date(record.created_at), 'hh:mm a')}
                                            </div>
                                        </div>

                                        {/* Change Detail Card */}
                                        <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-zinc-900 text-sm">
                                                    {record.action_type === 'delete' ? 'Deleted' :
                                                        record.action_type === 'add' ? 'Added' : 'Updated'}:
                                                    <span className="ml-1.5 opacity-60 font-medium line-through decoration-red-200 decoration-2">{record.event_title}</span>
                                                </h3>
                                                <div className="px-1.5 py-0.5 bg-zinc-50 rounded text-[9px] font-bold text-zinc-400 group-hover:bg-zinc-100 transition-colors">
                                                    {record.event_data?.type || 'Activity'}
                                                </div>
                                            </div>

                                            {/* Comment Section */}
                                            <div className="mt-3 relative">
                                                {editingId === record.id ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                            placeholder="Why did you change this?"
                                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[80px] resize-none"
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-700 active:scale-95 transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveComment(record.id)}
                                                                className="px-4 py-1.5 bg-zinc-900 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-zinc-900/10 active:scale-95 transition-all"
                                                            >
                                                                Save Note
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => handleStartEdit(record.id, record.comment)}
                                                        className={`group/comment relative w-full p-3 rounded-xl cursor-pointer transition-all
                                                            ${record.comment
                                                                ? 'bg-amber-50/50 border border-amber-100/50'
                                                                : 'bg-zinc-50 border border-zinc-100 hover:border-zinc-200'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <MessageSquare size={12} className={record.comment ? 'text-amber-500' : 'text-zinc-300'} />
                                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${record.comment ? 'text-amber-600' : 'text-zinc-400'}`}>
                                                                Note
                                                            </span>
                                                            <ChevronRight size={10} className="ml-auto opacity-0 group-hover/comment:opacity-100 transition-opacity text-zinc-400" />
                                                        </div>
                                                        <p className={`text-xs leading-relaxed ${record.comment ? 'text-zinc-700' : 'text-zinc-400 italic'}`}>
                                                            {record.comment || 'Add a comment for future reference...'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
