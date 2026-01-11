import { Layout } from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Clock, Image as ImageIcon, Utensils, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useTrip } from '../context/TripContext';

export default function PlaceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { events } = useTrip(); // Access global events
    const [activeTab, setActiveTab] = useState<'photos' | 'reviews' | 'menu'>('photos');

    // Find the event/place
    const event = events.find(e => e.id === id);

    // Default Fallback / Mock Data - Simulating Google Maps Data
    const place = {
        title: event?.title || 'Unknown Place',
        type: event?.type || 'Place',
        address: event?.description || 'Zwahlenweg 12, 8050 Zürich, Switzerland',
        rating: event?.rating || 4.8,
        reviews: event?.reviews || 1240,
        status: event?.status || 'Open',
        closeTime: event?.endTime || '11:00 PM',
        images: [
            `https://source.unsplash.com/random/800x600?${event?.type.toLowerCase() || 'switzerland'}`,
            'https://source.unsplash.com/random/800x600?interior',
            'https://source.unsplash.com/random/800x600?food',
            'https://source.unsplash.com/random/800x600?architecture'
        ],
        menu: [
            { name: 'House Special Fondue', price: 'CHF 28' },
            { name: 'Zürcher Geschnetzeltes', price: 'CHF 32' },
            { name: 'Rösti with Egg', price: 'CHF 18' },
        ],
        userReviews: [
            { user: 'Alex M.', rating: 5, text: 'Absolutely stunning views and great service. Highly recommend visiting during sunset!', time: '2 months ago' },
            { user: 'Sarah J.', rating: 4, text: 'Nice atmosphere but a bit pricey for the portion sizes. The staff was lovely though.', time: '1 month ago' },
            { user: 'David K.', rating: 5, text: 'Best experience in Zurich so far. A must-visit.', time: '3 weeks ago' },
        ]
    };

    if (!event) {
        return (
            <Layout showNav={false}>
                <div className="p-6 text-center pt-20 bg-zinc-950 min-h-screen">
                    <h1 className="text-white font-bold text-xl">Place not found</h1>
                    <button onClick={() => navigate(-1)} className="text-[#007AFF] mt-4 font-bold">Go Back</button>
                </div>
            </Layout>
        )
    }

    return (
        <Layout showNav={false}>
            {/* Hero Header */}
            <div className="relative h-72 w-full bg-zinc-900">
                <img
                    src={place.images[0]}
                    className="w-full h-full object-cover opacity-80"
                    alt="Place Hero"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-zinc-950"></div>

                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>
            </div>

            <div className="px-6 -mt-12 relative z-10 pb-24">
                <div className="bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-6 border border-white/5 shadow-2xl mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">{place.title}</h1>
                    <div className="flex items-center text-zinc-400 text-sm gap-2 mb-6">
                        <MapPin size={16} className="text-[#007AFF]" />
                        <span>{place.address}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-yellow-500 mb-0.5">
                                <Star size={16} fill="currentColor" />
                                <span className="font-bold text-white">{place.rating}</span>
                                <span className="text-zinc-500 text-xs font-medium">({place.reviews} Google reviews)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <Clock size={14} className="text-emerald-500" />
                                <span className="text-emerald-500 font-bold">Open now</span>
                                <span className="text-zinc-500">– Closes {place.closeTime}</span>
                            </div>
                        </div>
                        <button className="bg-[#007AFF] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                            Directions
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 mb-6 border-b border-white/5 px-2 overflow-x-auto no-scrollbar">
                    <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} icon={<ImageIcon size={18} />} label="Photos" />
                    <TabButton active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} icon={<MessageSquare size={18} />} label="Reviews" />
                    <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Utensils size={18} />} label="Menu" />
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === 'photos' && (
                        <div className="grid grid-cols-2 gap-3">
                            {place.images.map((img, i) => (
                                <img key={i} src={img} className="rounded-2xl h-40 w-full object-cover border border-white/5 hover:opacity-90 transition-opacity" alt="Gallery" />
                            ))}
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <div className="space-y-4">
                            {place.userReviews.map((review, i) => (
                                <div key={i} className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-white font-bold text-sm">{review.user}</div>
                                        <div className="text-xs text-zinc-500">{review.time}</div>
                                    </div>
                                    <div className="flex text-yellow-500 mb-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-zinc-700"} />
                                        ))}
                                    </div>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{review.text}</p>
                                </div>
                            ))}
                            <button className="w-full py-4 text-[#007AFF] font-bold text-sm">View all on Google Maps</button>
                        </div>
                    )}

                    {activeTab === 'menu' && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold text-white mb-4">Popular Items</h3>
                            {place.menu.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                    <span className="text-zinc-200 font-medium">{item.name}</span>
                                    <span className="font-bold text-[#007AFF]">{item.price}</span>
                                </div>
                            ))}
                            <button className="w-full mt-2 py-3 bg-zinc-900 border border-white/10 rounded-xl text-zinc-300 font-bold text-sm">Full Menu</button>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 pb-3 px-1 transition-all border-b-2 font-medium text-sm ${active
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
        >
            {icon}
            <span className="whitespace-nowrap">{label}</span>
        </button>
    )
}
