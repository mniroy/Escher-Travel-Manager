import { Layout } from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, Star, Clock, Image as ImageIcon, Utensils, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTrip } from '../context/TripContext';

export default function PlaceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { events } = useTrip();
    const [activeTab, setActiveTab] = useState<'photos' | 'reviews' | 'menu'>('photos');
    const [fetchedPlace, setFetchedPlace] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const event = events.find(e => e.id === id);

    // Initial place details from local event
    const initialPlace = event ? {
        title: event.title,
        address: event.description || '',
        rating: event.rating || 0,
        reviews: event.reviews || 0,
        status: event.status || 'Unknown',
        closeTime: '', // Will be fetched
        images: event.image ? [event.image] : [],
        userReviews: [],
        googleMapsLink: event.googleMapsLink
    } : null;

    useEffect(() => {
        const fetchDetails = async () => {
            if (!event) return;
            setLoading(true);

            try {
                // Determine fetch method: placeId > parse URL
                let placeIdToUse = event.placeId;

                // If no placeId, try to extract from URL if possible, though currently API needs explicit placeId or we use the parse endpoint again?
                // Actually, let's use the parse-place API if we don't have an ID, or place-details if we do.
                // For simplicity/consistency, if we have a link but no ID, we can first re-parse it or just rely on what we have.
                // But the best path is: if we have placeId, use /api/place-details. If only link, use /api/parse-place to get fresh data including ID.

                let data;
                if (placeIdToUse) {
                    const res = await fetch(`/api/place-details?placeId=${placeIdToUse}`);
                    if (res.ok) data = await res.json();
                } else if (event.googleMapsLink) {
                    const res = await fetch('/api/parse-place', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: event.googleMapsLink })
                    });
                    if (res.ok) {
                        const parseResult = await res.json();
                        // parse-place result format is different from place-details, let's normalize or check
                        // Actually parse-place returns a normalized object similar to what we need
                        data = parseResult;
                        // If parse-place returns a placeId, we could hypothetically fetch more details, but parse-place v1 usually does text search which returns basic details.
                        // Let's stick with what we get.
                    }
                }

                if (data) {
                    setFetchedPlace(data);
                }
            } catch (err) {
                console.error("Failed to fetch place details", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [event]);

    if (!event || !initialPlace) {
        return (
            <Layout showNav={false}>
                <div className="p-6 text-center pt-20 bg-zinc-950 min-h-screen">
                    <h1 className="text-white font-bold text-xl">Place not found</h1>
                    <button onClick={() => navigate(-1)} className="text-[#007AFF] mt-4 font-bold">Go Back</button>
                </div>
            </Layout>
        )
    }

    // Merge initial data with fetched data
    // Use fetched data if available, otherwise fallback
    const display = {
        title: fetchedPlace?.name || fetchedPlace?.displayName || initialPlace.title,
        address: fetchedPlace?.formattedAddress || fetchedPlace?.address || initialPlace.address,
        rating: fetchedPlace?.rating || initialPlace.rating,
        reviews: fetchedPlace?.userRatingCount || fetchedPlace?.reviewCount || initialPlace.reviews,
        status: fetchedPlace?.isOpen === true ? 'Open now' : (fetchedPlace?.isOpen === false ? 'Closed' : initialPlace.status),
        statusColor: fetchedPlace?.isOpen === true ? 'text-emerald-500' : (fetchedPlace?.isOpen === false ? 'text-red-500' : 'text-zinc-500'),
        closeTime: fetchedPlace?.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || '',
        images: (fetchedPlace?.photoUrls && fetchedPlace.photoUrls.length > 0) ? fetchedPlace.photoUrls : (fetchedPlace?.photos?.filter((p: string) => typeof p === 'string') || initialPlace.images),
        userReviews: fetchedPlace?.reviews || [], // Google reviews format
        googleMapsLink: fetchedPlace?.googleMapsUri || fetchedPlace?.googleMapsUrl || initialPlace.googleMapsLink,
        menu: [] // API doesn't provide menu usually
    };

    return (
        <Layout showNav={false}>
            {/* Hero Header */}
            <div className="relative h-72 w-full bg-zinc-900 group">
                {display.images.length > 0 ? (
                    <img
                        src={display.images[0]}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                        alt="Place Hero"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <ImageIcon size={48} className="text-zinc-600" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-zinc-950"></div>

                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20">
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
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">{display.title}</h1>
                    <div className="flex items-center text-zinc-400 text-sm gap-2 mb-6">
                        <MapPin size={16} className="text-[#007AFF]" />
                        <span className="line-clamp-2">{display.address}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-yellow-500 mb-0.5">
                                <Star size={16} fill="currentColor" />
                                <span className="font-bold text-white">{display.rating || 'New'}</span>
                                <span className="text-zinc-500 text-xs font-medium">({display.reviews || 0} reviews)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <Clock size={14} className={display.statusColor} />
                                <span className={`${display.statusColor} font-bold`}>{display.status}</span>
                                {display.closeTime && <span className="text-zinc-500 hidden sm:inline">– {display.closeTime}</span>}
                            </div>
                        </div>
                        {display.googleMapsLink && (
                            <a
                                href={display.googleMapsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#007AFF] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                            >
                                Directions <ArrowRight size={14} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 mb-6 border-b border-white/5 px-2 overflow-x-auto no-scrollbar">
                    <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} icon={<ImageIcon size={18} />} label="Photos" />
                    <TabButton active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} icon={<MessageSquare size={18} />} label="Reviews" />
                    {/* Only show menu if we have items, otherwise keep it hidden as it's usually empty for API data */}
                    {display.menu.length > 0 && <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Utensils size={18} />} label="Menu" />}
                </div>

                {/* Tab Content */}
                <div className="min-h-[200px]">
                    {loading && (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin text-[#007AFF]"><Clock size={24} /></div>
                        </div>
                    )}

                    {!loading && activeTab === 'photos' && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-500">
                            {display.images.map((img: string, i: number) => (
                                <img key={i} src={img} className="rounded-2xl h-40 w-full object-cover border border-white/5 hover:opacity-90 transition-opacity bg-zinc-800" alt="Gallery" />
                            ))}
                            {display.images.length === 0 && (
                                <div className="col-span-2 text-center py-10 text-zinc-500">
                                    No photos available
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && activeTab === 'reviews' && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            {display.userReviews.length > 0 ? (
                                display.userReviews.map((review: any, i: number) => (
                                    <div key={i} className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {review.authorAttribution?.photoUri && (
                                                    <img src={review.authorAttribution.photoUri} className="w-6 h-6 rounded-full" alt="" />
                                                )}
                                                <div className="text-white font-bold text-sm">
                                                    {review.authorAttribution?.displayName || review.name || 'Google User'}
                                                </div>
                                            </div>
                                            <div className="text-xs text-zinc-500">{review.relativePublishTimeDescription}</div>
                                        </div>
                                        <div className="flex text-yellow-500 mb-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={12} fill={i < (review.rating || 0) ? "currentColor" : "none"} className={i < (review.rating || 0) ? "" : "text-zinc-700"} />
                                            ))}
                                        </div>
                                        <p className="text-sm text-zinc-400 leading-relaxed text-left">{review.text?.text || review.text}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-zinc-500">
                                    No reviews available
                                </div>
                            )}

                            {display.googleMapsLink && (
                                <a
                                    href={display.googleMapsLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full text-center py-4 text-[#007AFF] font-bold text-sm hover:underline"
                                >
                                    View all on Google Maps
                                </a>
                            )}
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
