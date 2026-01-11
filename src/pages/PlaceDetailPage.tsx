import { Layout } from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Clock, Image as ImageIcon, Receipt, Utensils, Ticket as TicketIcon } from 'lucide-react';
import { useState } from 'react';

export default function PlaceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'photos' | 'tickets' | 'menu' | 'receipts'>('photos');

    // distinct mock data usually fetched by ID
    const place = {
        title: 'Elfrentes Roasting',
        type: 'Restaurant',
        address: 'Bahnhofpl. 7, 8001 Zürich, Switzerland',
        rating: 4.7,
        reviews: 2735,
        status: 'Open',
        closeTime: '11:00 PM',
        images: [
            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=1000&auto=format&fit=crop'
        ],
        menu: [
            { name: 'Espresso', price: 'CHF 4.50' },
            { name: 'Cappuccino', price: 'CHF 5.50' },
            { name: 'Avocado Toast', price: 'CHF 12.00' }
        ]
    };

    return (
        <Layout showNav={false}>
            {/* Hero Header */}
            <div className="relative h-72 w-full">
                <img
                    src={place.images[0]}
                    className="w-full h-full object-cover"
                    alt="Place Hero"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background"></div>

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-12 left-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                >
                    <ArrowLeft size={24} />
                </button>
            </div>

            <div className="px-6 -mt-12 relative z-10">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-6">
                    <h1 className="text-2xl font-bold text-white mb-2">{place.title}</h1>
                    <div className="flex items-center text-muted text-sm gap-2 mb-4">
                        <MapPin size={16} className="text-primary" />
                        <span>{place.address}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/10 pt-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1 text-yellow-400 mb-1">
                                <Star size={16} fill="currentColor" />
                                <span className="font-bold">{place.rating}</span>
                                <span className="text-muted text-xs">({place.reviews})</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                                <Clock size={14} className="text-green-400" />
                                <span className="text-green-400 font-medium">Open now</span>
                                <span className="text-muted">– Closes {place.closeTime}</span>
                            </div>
                        </div>
                        <button className="bg-primary text-background px-4 py-2 rounded-lg font-bold text-sm shadow-glow">
                            Get Directions
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-white/10 pb-2 overflow-x-auto">
                    <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} icon={<ImageIcon size={18} />} label="Photos" />
                    <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<TicketIcon size={18} />} label="Tickets" />
                    <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Utensils size={18} />} label="Menu" />
                    <TabButton active={activeTab === 'receipts'} onClick={() => setActiveTab('receipts')} icon={<Receipt size={18} />} label="Receipts" />
                </div>

                {/* Tab Content */}
                <div className="pb-8">
                    {activeTab === 'photos' && (
                        <div className="grid grid-cols-2 gap-4">
                            {place.images.map((img, i) => (
                                <img key={i} src={img} className="rounded-xl h-40 w-full object-cover border border-white/10" alt="Gallery" />
                            ))}
                            <div className="rounded-xl h-40 w-full flex items-center justify-center border border-dashed border-white/20 bg-white/5 text-muted">
                                <span>+ Add Photo</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'menu' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Menu Items</h3>
                            {place.menu.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-4 glass-panel rounded-xl border border-white/5">
                                    <span>{item.name}</span>
                                    <span className="font-bold text-primary">{item.price}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {(activeTab === 'tickets' || activeTab === 'receipts') && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                {activeTab === 'tickets' ? <TicketIcon size={32} /> : <Receipt size={32} />}
                            </div>
                            <p>No {activeTab} uploaded yet</p>
                            <button className="text-primary font-medium text-sm">Upload {activeTab}</button>
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
            className={`flex items-center gap-2 pb-2 px-2 transition-colors border-b-2 ${active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-white'}`}
        >
            {icon}
            <span className="whitespace-nowrap">{label}</span>
        </button>
    )
}
