import { Layout } from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, Star, Clock, Image as ImageIcon, MessageSquare, X, Ticket } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTrip } from '../context/TripContext';

export default function PlaceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { events } = useTrip();
    const [activeTab, setActiveTab] = useState<'photos' | 'hours' | 'tickets' | 'reviews'>('photos');
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
        title: fetchedPlace?.displayName || initialPlace.title,
        address: fetchedPlace?.formattedAddress || fetchedPlace?.address || initialPlace.address,
        rating: fetchedPlace?.rating || initialPlace.rating,
        reviews: fetchedPlace?.userRatingCount || fetchedPlace?.reviewCount || initialPlace.reviews,
        itineraryStatus: (initialPlace.status && initialPlace.status !== 'Unknown') ? initialPlace.status : null,
        liveStatus: fetchedPlace?.regularOpeningHours?.openNow === true ? 'Open now' : (fetchedPlace?.regularOpeningHours?.openNow === false ? 'Closed' : null),
        liveStatusColor: fetchedPlace?.regularOpeningHours?.openNow === true ? 'text-emerald-500' : (fetchedPlace?.regularOpeningHours?.openNow === false ? 'text-red-500' : 'text-zinc-500'),
        closeTime: fetchedPlace?.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || '',
        images: (fetchedPlace?.photoUrls && fetchedPlace.photoUrls.length > 0) ? fetchedPlace.photoUrls : (fetchedPlace?.photos?.filter((p: string) => typeof p === 'string') || initialPlace.images),
        userReviews: fetchedPlace?.reviews || [], // Google reviews format
        googleMapsLink: fetchedPlace?.googleMapsUri || fetchedPlace?.googleMapsUrl || initialPlace.googleMapsLink,
        menus: [], // API doesn't provide menu usually
        openingHours: fetchedPlace?.openingHours || fetchedPlace?.regularOpeningHours?.weekdayDescriptions || [],
        websiteUri: fetchedPlace?.websiteUri || null,
        priceLevel: fetchedPlace?.priceLevel || null,
        editorialSummary: fetchedPlace?.editorialSummary || null,
        types: fetchedPlace?.types || []
    };

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Helper to format price level
    const formatPriceLevel = (level: string | null) => {
        if (!level) return null;
        const map: Record<string, string> = {
            'PRICE_LEVEL_FREE': 'Free',
            'PRICE_LEVEL_INEXPENSIVE': '$',
            'PRICE_LEVEL_MODERATE': '$$',
            'PRICE_LEVEL_EXPENSIVE': '$$$',
            'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
        };
        return map[level] || level;
    };

    const formattedPrice = formatPriceLevel(display.priceLevel);

    // Helper to check if place is dining related
    const isDining = display.types.some((t: string) =>
        ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'food'].includes(t)
    );

    return (
        <Layout showNav={false}>
            {/* Hero Header */}
            <div className="relative h-72 w-full bg-zinc-200 group">
                {display.images.length > 0 ? (
                    <img
                        src={display.images[0]}
                        className="w-full h-full object-cover opacity-100"
                        alt="Place Hero"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                        <ImageIcon size={48} className="text-zinc-300" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-zinc-50/90"></div>

                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors shadow-lg"
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>
            </div>

            <div className="px-6 -mt-12 relative z-10 pb-24">
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 border border-white/40 shadow-xl shadow-zinc-200/50 mb-8">
                    <h1 className="text-3xl font-extrabold text-zinc-900 mb-2 leading-tight">{display.title}</h1>
                    <div className="flex items-start text-zinc-500 text-sm gap-3 mb-6 font-medium">
                        <div className="mt-0.5 shrink-0"><MapPin size={18} className="text-[#007AFF]" /></div>
                        <span className="leading-relaxed">{display.address}</span>
                    </div>

                    <div className="flex justify-between items-end border-t border-zinc-100 pt-5">
                        <div className="flex flex-col gap-2.5">
                            {/* Rating */}
                            <div className="flex items-center gap-3">
                                <div className="shrink-0"><Star size={18} fill="currentColor" className="text-yellow-400" /></div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-zinc-900 leading-none">{display.rating || 'New'}</span>
                                    <span className="text-zinc-400 text-xs font-medium leading-none">({display.reviews?.toLocaleString() || 0} reviews)</span>
                                </div>
                            </div>

                            {/* Itinerary Status */}
                            {display.itineraryStatus && (
                                <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
                                    <div className="shrink-0"><Clock size={18} /></div>
                                    <span className="leading-none">{display.itineraryStatus}</span>
                                </div>
                            )}

                            {/* Live Status */}
                            {display.liveStatus && (
                                <div className="flex items-center gap-3 text-sm font-bold">
                                    <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${display.liveStatus === 'Open now' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`${display.liveStatusColor} leading-none`}>{display.liveStatus}</span>
                                        {display.closeTime && <span className="text-zinc-400 font-medium hidden sm:inline leading-none">– {display.closeTime}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                        {display.googleMapsLink && (
                            <a
                                href={display.googleMapsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#007AFF] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-[#0062cc] active:scale-95 transition-all flex items-center gap-2"
                            >
                                Directions <ArrowRight size={14} />
                            </a>
                        )}
                    </div>
                </div>

                <div className="flex gap-6 mb-6 border-b border-zinc-200 px-2 overflow-x-auto no-scrollbar justify-center">
                    <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} icon={<ImageIcon size={18} />} label="Photos" />
                    {display.openingHours.length > 0 && <TabButton active={activeTab === 'hours'} onClick={() => setActiveTab('hours')} icon={<Clock size={18} />} label="Hours" />}

                    {!isDining && display.priceLevel && <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket size={18} />} label={formattedPrice ? `Tickets (${formattedPrice})` : "Ticket Info"} />}

                    <TabButton active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} icon={<MessageSquare size={18} />} label="Reviews" />
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
                                <motion.img
                                    key={i}
                                    src={img}
                                    layoutId={`img-${i}`}
                                    onClick={() => setSelectedImage(img)}
                                    className="rounded-2xl h-40 w-full object-cover cursor-zoom-in hover:opacity-95 transition-opacity bg-zinc-100 shadow-sm"
                                    alt="Gallery"
                                />
                            ))}
                            {display.images.length === 0 && (
                                <div className="col-span-2 text-center py-10 text-zinc-400 font-medium">
                                    No photos available
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && activeTab === 'hours' && (
                        <div className="px-2 animate-in fade-in duration-500">
                            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                                <div className="space-y-2">
                                    {display.openingHours.map((line: string, i: number) => {
                                        const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                                        const isToday = i === todayIndex;
                                        const [day, time] = line.split(': ');
                                        return (
                                            <div key={i} className={`flex justify-between text-xs ${isToday ? 'font-bold text-zinc-900 bg-white p-2 -mx-2 rounded-lg shadow-sm border border-zinc-100' : 'text-zinc-600'}`}>
                                                <span>{day}</span>
                                                <span>{time}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'tickets' && (
                        <div className="px-2 animate-in fade-in duration-500">
                            <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
                                <h3 className="font-bold text-zinc-900 mb-1">Admission</h3>
                                {display.editorialSummary && (
                                    <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{display.editorialSummary}</p>
                                )}
                                <p className="text-xs text-zinc-400 mb-6">Gives you entry to this place</p>

                                <div className="space-y-3">
                                    {display.websiteUri && (
                                        <a
                                            href={display.websiteUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between group py-1"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#007AFF] flex items-center justify-center">
                                                    <Ticket size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-zinc-900 group-hover:text-[#007AFF] transition-colors">Official Site</span>
                                                    <span className="text-[10px] text-zinc-400 font-medium">Instant confirmation</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {formattedPrice && <span className="text-sm font-bold text-zinc-900">{formattedPrice}</span>}
                                                <ArrowRight size={14} className="text-zinc-300 group-hover:text-[#007AFF] transition-colors" />
                                            </div>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'reviews' && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            {display.userReviews.length > 0 ? (
                                display.userReviews.map((review: any, i: number) => (
                                    <div key={i} className="p-5 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                {review.authorAttribution?.photoUri ? (
                                                    <img src={review.authorAttribution.photoUri} className="w-8 h-8 rounded-full border border-zinc-100" alt="" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-[#007AFF] flex items-center justify-center font-bold text-xs">
                                                        {(review.authorAttribution?.displayName || review.name || 'G')[0]}
                                                    </div>
                                                )}
                                                <div className="text-zinc-900 font-bold text-sm">
                                                    {review.authorAttribution?.displayName || review.name || 'Google User'}
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded-full">{review.relativePublishTimeDescription}</div>
                                        </div>
                                        <div className="flex text-yellow-400 mb-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={14} fill={i < (review.rating || 0) ? "currentColor" : "none"} className={i < (review.rating || 0) ? "" : "text-zinc-200"} />
                                            ))}
                                        </div>
                                        <p className="text-sm text-zinc-600 leading-relaxed text-left font-medium">{review.text?.text || review.text}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-zinc-400 font-medium">
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

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
                    >
                        <button
                            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>
                        <motion.img
                            layoutId={display.images.includes(selectedImage) ? `img-${display.images.indexOf(selectedImage)}` : 'selected-img'}
                            src={selectedImage}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            alt="Full screen"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 pb-3 px-1 transition-all border-b-2 font-bold text-sm ${active
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
        >
            {icon}
            <span className="whitespace-nowrap">{label}</span>
        </button>
    )
}
