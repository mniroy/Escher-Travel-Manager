import { Layout } from '../components/Layout';
import { FileText, Plus } from 'lucide-react';

export default function DocumentsPage() {
    return (
        <Layout>
            <div className="p-6 pt-12">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Documents</h1>
                        <p className="text-zinc-400">Tickets, confirmations, and notes.</p>
                    </div>
                    <button className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-all">
                        <Plus size={20} />
                    </button>
                </header>

                <div className="space-y-4">
                    {/* Placeholder Document Card */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:bg-zinc-900 transition-colors cursor-pointer">
                        <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-white">Flight Check-in.pdf</h3>
                            <p className="text-xs text-zinc-500">Added 2 days ago • 1.2 MB</p>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:bg-zinc-900 transition-colors cursor-pointer">
                        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-white">Hotel Booking - BVLGARI.pdf</h3>
                            <p className="text-xs text-zinc-500">Added 5 days ago • 840 KB</p>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
