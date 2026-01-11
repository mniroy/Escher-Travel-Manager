import { Layout } from '../components/Layout';
import { MapPin, Search } from 'lucide-react';

export default function PlacesPage() {
    return (
        <Layout>
            <div className="p-6 pt-12">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Saved Places</h1>
                    <p className="text-zinc-400">Your favorite spots and discoveries.</p>
                </header>

                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search places..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-zinc-700 placeholder:text-zinc-600"
                    />
                </div>

                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                        <MapPin className="text-zinc-600" size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">No places saved yet</h3>
                        <p className="text-zinc-500 max-w-xs mx-auto mt-1">
                            Places you heart or save from the map will appear here.
                        </p>
                    </div>
                    <button className="bg-primary text-background font-bold px-6 py-2 rounded-full mt-4 hover:bg-primary/90 transition-colors">
                        Explore Map
                    </button>
                </div>
            </div>
        </Layout>
    );
}
