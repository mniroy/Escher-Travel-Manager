
import { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        google: any;
        initGoogleMaps?: () => void;
    }
}

interface MapComponentProps {
    apiKey: string;
    center?: { lat: number; lng: number };
    zoom?: number;
    markers?: Array<{
        id: string;
        lat: number;
        lng: number;
        title?: string;
        label?: string;
        color?: string;
        congestion?: string;
    }>;
    className?: string;
}

export function MapComponent({
    apiKey,
    center = { lat: -8.409518, lng: 115.188919 }, // Default to Bali
    zoom = 10,
    markers = [],
    className = "w-full h-full"
}: MapComponentProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const directionsRendererRef = useRef<any>(null);
    const polylinesRef = useRef<any[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [scriptLoadError, setScriptLoadError] = useState<string>('');
    const [routeError, setRouteError] = useState<string>('');

    // Pre-check for API Key
    if (!apiKey) {
        return (
            <div className={`${className} flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl p-6`}>
                <div className="text-center">
                    <p className="text-red-400 font-bold mb-2">Google Maps API Key Missing</p>
                    <p className="text-zinc-500 text-sm">Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.</p>
                </div>
            </div>
        );
    }

    // 1. Load Script
    useEffect(() => {
        if (window.google?.maps) {
            setIsLoaded(true);
            return;
        }

        if (document.getElementById('google-maps-script')) {
            const check = setInterval(() => {
                if (window.google?.maps) {
                    setIsLoaded(true);
                    clearInterval(check);
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setScriptLoadError('Failed to load Google Maps script.');
        document.body.appendChild(script);
    }, [apiKey]);

    // 2. Initialize Map
    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center,
                zoom,
                mapId: 'DEMO_MAP_ID',
                disableDefaultUI: true,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                backgroundColor: '#27272a',
            });
        }
    }, [isLoaded]);

    // 3. Update Center/Zoom
    useEffect(() => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(center);
            mapInstanceRef.current.setZoom(zoom);
        }
    }, [center, zoom]);

    const [currentZoom, setCurrentZoom] = useState(zoom);

    // Update internal zoom when map changes
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const listener = mapInstanceRef.current.addListener('zoom_changed', () => {
            setCurrentZoom(mapInstanceRef.current.getZoom());
        });

        return () => {
            window.google.maps.event.removeListener(listener);
        };
    }, [isLoaded]);

    // 4. Update Markers
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        // Clear existing
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        // Group markers by location to detect overlaps
        const markersByLoc: Record<string, typeof markers> = {};
        markers.forEach(m => {
            const key = `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
            if (!markersByLoc[key]) markersByLoc[key] = [];
            markersByLoc[key].push(m);
        });

        markers.forEach(m => {
            const key = `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
            const group = markersByLoc[key];
            const indexInGroup = group.indexOf(m);

            // Apply slight offset if multiple markers at same location
            let finalLat = m.lat;
            let finalLng = m.lng;

            if (group.length > 1) {
                // Dynamic Offset Calculation based on Zoom
                // Goal: Constant pixel separate (approx)
                // At Zoom 15, 0.00015 deg is good (~16m)
                // As zoom decreases (farther), degrees per pixel doubles every step.
                // So we need to INCREASE the degree offset as zoom DECREASES.
                // Formula: BaseOffset * 2^(RefZoom - CurrentZoom)

                const refZoom = 15;
                const baseOffset = 0.00015;
                const scale = Math.pow(2, refZoom - currentZoom);

                // Limit scale to avoid massive jumps at low zoom (e.g. world view)
                // Max scale for zoom 5 would be 2^10 = 1024 -> 0.15 degrees. That's fine.
                const offsetStep = baseOffset * scale;

                const shift = (indexInGroup - (group.length - 1) / 2) * offsetStep;
                finalLng += shift;

                // Optional: slight lat shift to prevent horizontal line overlap
                // Scale lat offset too
                finalLat += (indexInGroup % 2 === 0 ? 0 : (0.00005 * scale));
            }

            const marker = new window.google.maps.Marker({
                position: { lat: finalLat, lng: finalLng },
                map: mapInstanceRef.current,
                title: m.title,
                label: {
                    text: m.label || '',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px'
                },
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 14,
                    fillColor: m.color || '#007AFF',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    labelOrigin: new window.google.maps.Point(0, 0)
                },
                zIndex: 100 + indexInGroup // Ensure later markers in group are on top (or reverse if preferred)
            });

            markersRef.current.push(marker);
        });
    }, [markers, isLoaded, currentZoom]);

    // 5. Update Path (REAL DIRECTIONS)
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google?.maps) return;

        // Reset error on new attempt
        setRouteError('');

        // Cleanup previous renderer
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
            directionsRendererRef.current = null;
        }

        // We need at least 2 points for a route
        if (markers.length < 2) return;

        const directionsService = new window.google.maps.DirectionsService();

        // Create Renderer
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
            map: mapInstanceRef.current,
            suppressMarkers: true, // We use our own custom markers
            polylineOptions: {
                strokeColor: '#007AFF',
                strokeWeight: 5,
                strokeOpacity: 0.8
            }
        });

        // Build Request
        const origin = { lat: markers[0].lat, lng: markers[0].lng };
        const destination = { lat: markers[markers.length - 1].lat, lng: markers[markers.length - 1].lng };

        const waypoints = markers.slice(1, -1).map(m => ({
            location: { lat: m.lat, lng: m.lng },
            stopover: true
        }));

        directionsService.route({
            origin,
            destination,
            waypoints,
            travelMode: window.google.maps.TravelMode.DRIVING
        }, (result: any, status: any) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
                directionsRendererRef.current.setDirections(result);

                // Optional: Fit bounds? DirectionsRenderer does this by default if preserveViewport is false (which it is by default)
                // If we manually control zoom, we might want PreserveViewport: true
            } else {
                console.error('Directions request failed due to ' + status);
                setRouteError(`Route: ${status}`);
            }
        });

    }, [markers, isLoaded]); // Re-run when markers change OR map loads



    if (scriptLoadError) {
        return (
            <div className={`${className} flex items-center justify-center bg-zinc-900 text-red-400 p-4 text-center`}>
                <div>
                    <p className="font-bold mb-1">Map Script Error</p>
                    <p className="text-sm opacity-80">{scriptLoadError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <div ref={mapRef} className={className} />

            {/* Non-blocking Route Error Toaster */}
            {routeError && (
                <div className="absolute top-2 left-2 right-2 bg-red-500/90 text-white text-[10px] px-3 py-2 rounded-lg backdrop-blur shadow-lg z-50 pointer-events-none text-center">
                    {routeError}
                </div>
            )}
        </div>
    );
}
