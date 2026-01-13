
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
        type?: 'Transport' | 'Stay' | 'Eat' | 'Play';
        isRoutePoint?: boolean;
    }>;
    className?: string;
    onRouteInfo?: (totalDistance: number, totalDuration: number) => void;
    onMarkerClick?: (id: string) => void;
    onMapClick?: () => void;
}

// Simple SVG Paths for Icons (approximate)
const ICONS = {
    Transport: "M22 16.92v3L12 15v-9H9v9L-1 16.92v3L9 18.5v9l1.5 1.5 1.5-1.5v-9l10 1.42z", // Plane-ish
    Stay: "M19 7h-8v6h8V7zm2-4H3C2.45 3 2 3.45 2 4v16h2v-2h16v2h2V4c0-.55-.45-1-1-1zm-1 9H4V5h16v7z", // Bed
    Eat: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z", // Fork/Knife
    Play: "M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z" // Dashboard/Ticket shape
};

export function MapComponent({
    apiKey,
    center = { lat: -8.409518, lng: 115.188919 }, // Default to Bali
    zoom = 10,
    markers = [],
    className = "w-full h-full",
    onRouteInfo,
    onMarkerClick,
    onMapClick
}: MapComponentProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const directionsRendererRef = useRef<any>(null);

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
                gestureHandling: 'greedy',
            });

            if (onMapClick) {
                mapInstanceRef.current.addListener("click", () => {
                    onMapClick();
                });
            }
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
                // Dynamic Offset Calculation
                const refZoom = 15;
                const baseOffset = 0.00015;
                const scale = Math.pow(2, refZoom - currentZoom);
                const offsetStep = baseOffset * scale;

                const shift = (indexInGroup - (group.length - 1) / 2) * offsetStep;
                finalLng += shift;
                finalLat += (indexInGroup % 2 === 0 ? 0 : (0.00005 * scale));
            }

            // Determine Icon
            let icon: any;
            if (m.type && ICONS[m.type]) {
                const scale = 0.65;
                const offset = 12 * (1 - scale); // Center the icon

                const svg = `
                <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="11" fill="${m.color || '#6B7280'}" stroke="white" stroke-width="2"/>
                    <path d="${ICONS[m.type]}" fill="white" transform="translate(${offset}, ${offset}) scale(${scale})"/>
                </svg>`.trim();

                // Custom Icon for POIs (Icon inside Circle)
                icon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                    scaledSize: new window.google.maps.Size(32, 32),
                    anchor: new window.google.maps.Point(16, 16)
                };
            } else {
                // Default Circle for Route Points
                icon = {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 14,
                    fillColor: m.color || '#007AFF',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    labelOrigin: new window.google.maps.Point(0, 0)
                };
            }

            const marker = new window.google.maps.Marker({
                position: { lat: finalLat, lng: finalLng },
                map: mapInstanceRef.current,
                title: m.title,
                label: m.label ? {
                    text: m.label || '',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px'
                } : null,
                icon: icon,
                zIndex: m.isRoutePoint ? (100 + indexInGroup) : 10 // Route points on top
            });

            if (onMarkerClick) {
                marker.addListener("click", () => {
                    onMarkerClick(m.id);
                });
            }

            markersRef.current.push(marker);
        });
    }, [markers, isLoaded, currentZoom, onMarkerClick]);

    // 5. Update Path (REAL DIRECTIONS) - ONLY FOR ROUTE POINTS
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google?.maps) return;

        // Reset error on new attempt
        setRouteError('');

        // Cleanup previous renderer
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
            directionsRendererRef.current = null;
        }

        // Filter for route points
        const routeMarkers = markers.filter(m => m.isRoutePoint);

        // We need at least 2 points for a route
        if (routeMarkers.length < 2) return;

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
        const origin = { lat: routeMarkers[0].lat, lng: routeMarkers[0].lng };
        const destination = { lat: routeMarkers[routeMarkers.length - 1].lat, lng: routeMarkers[routeMarkers.length - 1].lng };

        const waypoints = routeMarkers.slice(1, -1).map(m => ({
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

                if (onRouteInfo && result.routes[0]) {
                    const route = result.routes[0];
                    let totalDistMeters = 0;
                    let totalDurSeconds = 0;
                    route.legs.forEach((leg: any) => {
                        totalDistMeters += leg.distance.value;
                        totalDurSeconds += leg.duration.value;
                    });
                    onRouteInfo(totalDistMeters / 1000, Math.floor(totalDurSeconds / 60));
                }
            } else {
                console.error('Directions request failed due to ' + status);
                setRouteError(`Route: ${status}`);
            }
        });

    }, [markers, isLoaded, onRouteInfo]); // Re-run when markers change OR map loads

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
