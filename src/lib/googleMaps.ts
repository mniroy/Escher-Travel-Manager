// Google Maps URL parser utility
// Fetches place details from a Google Maps URL

export interface PlaceDetails {
    name: string;
    address: string;
    rating?: number;
    reviewCount?: number;
    placeId: string;
    types?: string[];
    photos?: string[];
    openingHours?: string[];
    website?: string;
    phoneNumber?: string;
    priceLevel?: number;
    lat?: number;
    lng?: number;
    googleMapsUrl: string;
}

export interface ParsePlaceResult {
    success: boolean;
    data?: PlaceDetails;
    error?: string;
}

// Extract place info from Google Maps URL
function extractPlaceInfo(url: string): { placeId?: string; query?: string; coords?: { lat: number; lng: number } } {
    const result: { placeId?: string; query?: string; coords?: { lat: number; lng: number } } = {};

    try {
        const urlObj = new URL(url);

        // FIRST: Extract name from URL path (most reliable for display)
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            result.query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        }

        // Extract place ID from data parameter (format: !1sChIJ... or !1s0x...)
        const dataMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/i);
        if (dataMatch) {
            result.placeId = dataMatch[1];
        }

        // Try to extract from place_id query param
        const placeIdParam = urlObj.searchParams.get('place_id');
        if (placeIdParam) {
            result.placeId = placeIdParam;
        }

        // Extract coordinates from URL
        const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
            result.coords = {
                lat: parseFloat(coordsMatch[1]),
                lng: parseFloat(coordsMatch[2])
            };
        }

        // Try to extract search query as fallback for name
        if (!result.query) {
            const qParam = urlObj.searchParams.get('q');
            if (qParam) {
                result.query = qParam;
            }
        }

        return result;
    } catch {
        return result;
    }
}

/**
 * Parse a Google Maps URL and fetch place details
 * Uses the API endpoint in production, or directly calls Google API in development
 */
export async function parseGoogleMapsUrl(url: string): Promise<ParsePlaceResult> {
    // First, try the API endpoint (works in Vercel deployment)

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased to 8s

        const response = await fetch('/api/parse-place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // If we get a valid response, use it
        if (response.ok) {
            const data = await response.json();
            if (data && data.name) {
                return { success: true, data: data as PlaceDetails };
            }
        }
    } catch (e) {
        console.warn('API parsing failed or timed out, falling back to local regex:', e);
        // API not available (local dev or crash), fall through to direct approach
    }

    // Fallback: Parse URL and extract basic info
    const placeInfo = extractPlaceInfo(url);

    // If we have a short link but no other info, we should still allow it
    // The user can fill in the details manually.
    const isShortLink = url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');

    if (!placeInfo.query && !placeInfo.coords && !placeInfo.placeId && !isShortLink) {
        return {
            success: false,
            error: 'Could not extract place info from URL. Try copying the full Google Maps URL.',
        };
    }

    // Return partial success for short links if extraction failed
    if (isShortLink && !placeInfo.query) {
        return {
            success: true,
            data: {
                name: 'New Place', // Placeholder
                address: 'Details from link',
                placeId: `link-${Date.now()}`,
                googleMapsUrl: url,
            },
        };
    }

    // If we have a query from the URL, use that as the title
    if (placeInfo.query) {
        return {
            success: true,
            data: {
                name: placeInfo.query.split(',')[0].trim(),
                address: placeInfo.query,
                placeId: placeInfo.placeId || 'unknown',
                googleMapsUrl: url,
            },
        };
    }

    // If we have coordinates, create a basic entry
    if (placeInfo.coords) {
        return {
            success: true,
            data: {
                name: 'Location',
                address: `${placeInfo.coords.lat}, ${placeInfo.coords.lng}`,
                placeId: placeInfo.placeId || 'unknown',
                lat: placeInfo.coords.lat,
                lng: placeInfo.coords.lng,
                googleMapsUrl: url,
            },
        };
    }

    // If we only have place ID, create minimal entry
    return {
        success: true,
        data: {
            name: 'Google Maps Location',
            address: 'See link for details',
            placeId: placeInfo.placeId || 'unknown',
            googleMapsUrl: url,
        },
    };
}

/**
 * Convert place type to event type
 */
export function placeTypeToEventType(types?: string[]): 'Transport' | 'Stay' | 'Eat' | 'Play' {
    if (!types) return 'Play';

    const typeMap: Record<string, 'Transport' | 'Stay' | 'Eat' | 'Play'> = {
        'airport': 'Transport',
        'bus_station': 'Transport',
        'train_station': 'Transport',
        'transit_station': 'Transport',
        'taxi_stand': 'Transport',
        'subway_station': 'Transport',
        'lodging': 'Stay',
        'hotel': 'Stay',
        'motel': 'Stay',
        'resort': 'Stay',
        'campground': 'Stay',
        'restaurant': 'Eat',
        'cafe': 'Eat',
        'bakery': 'Eat',
        'bar': 'Eat',
        'food': 'Eat',
        'meal_delivery': 'Eat',
        'meal_takeaway': 'Eat',
    };

    for (const type of types) {
        if (typeMap[type]) {
            return typeMap[type];
        }
    }

    return 'Play';
}

/**
 * Check if a string is a valid Google Maps URL
 */
export function isGoogleMapsUrl(text: string): boolean {
    return /^https?:\/\/(www\.)?(google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(text);
}

/**
 * Call the optimization API to reorder events
 */
export async function optimizeRoute(events: any[], options?: { preserveOrder: boolean }): Promise<any[]> {
    // We need at least 3 items to optimize 'intermediates' meaningfully (Origin -> A -> Destination), or 2 items to just get leg info.
    if (events.length < 2) return events;

    try {
        console.log('[Traffic Debug] Making API call with', events.length, 'events');
        const response = await fetch('/api/optimize-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: events,
                preserveOrder: options?.preserveOrder
            })
        });

        console.log('[Traffic Debug] API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Traffic Debug] Optimization failed:', errorText);
            return events;
        }

        const data = await response.json();
        console.log('[Traffic Debug] Response has routes:', !!data.routes, 'Count:', data.routes?.length);
        if (!data.routes || !data.routes[0]) {
            console.log('[Traffic Debug] No routes - Full response:', JSON.stringify(data, null, 2));
            return events;
        }

        const route = data.routes[0];
        const legs = route.legs;

        console.log('[Traffic Debug] Legs count:', legs?.length);

        // Origin is always first (events[0])
        // Destination is always last (events[last])
        // Intermediates are events[1...last-1]

        const origin = events[0];
        const destination = events[events.length - 1];
        const intermediates = events.slice(1, events.length - 1);

        let newIntermediates = intermediates;

        // If NOT preserving order, reorder intermediates based on API response
        if (!options?.preserveOrder && route.optimizedIntermediateWaypointIndex) {
            const optimizedIndices = route.optimizedIntermediateWaypointIndex;
            newIntermediates = optimizedIndices.map((i: number) => intermediates[i]);
        }

        const newOrder = [origin, ...newIntermediates, destination];

        // Apply Travel Times from Legs
        // Leg 0: Origin -> Waypoint 1 (newIntermediates[0])
        // Leg 1: Waypoint 1 -> Waypoint 2
        // ...
        // Leg Last: Waypoint Last -> Destination

        // The 'legs' array should correspond to the segments in the OPTIMIZED order (or preserved order).
        // legs[0] is travel to newOrder[1].

        newOrder.forEach((event, index) => {
            if (index === 0) {
                event.travelTime = undefined; // Origin has no incoming travel time from this trip
                event.congestion = undefined;
                return;
            }

            const leg = legs[index - 1]; // Leg 0 corresponds to index 1
            console.log(`[Traffic Debug] Event ${index}: ${event.title}, Leg:`, leg);

            if (leg && leg.duration) {
                // Duration format "1800s"
                const seconds = parseInt(leg.duration.replace('s', ''));
                const minutes = Math.ceil(seconds / 60);
                // Format: "25m" or "1h 5m"
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

                // Distance in KM with formatting
                const kmValue = leg.distanceMeters ? (leg.distanceMeters / 1000) : null;
                const distanceStr = kmValue !== null
                    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kmValue)
                    : null;

                event.travelTime = distanceStr ? `${timeStr} · ${distanceStr} KM` : timeStr;
                event.travelDistance = distanceStr ? `${distanceStr} KM` : undefined;

                // Calculate Congestion
                // staticDuration is the "normal" time without traffic
                if (leg.staticDuration) {
                    const staticSeconds = parseInt(leg.staticDuration.replace('s', ''));
                    const ratio = seconds / staticSeconds;
                    console.log(`[Traffic Debug] Ratio for ${event.title}: ${ratio.toFixed(2)} (${seconds}s / ${staticSeconds}s)`);

                    if (ratio > 1.3) event.congestion = 'high'; // >30% slower (Red)
                    else if (ratio > 1.1) event.congestion = 'moderate'; // >10% slower (Yellow)
                    else event.congestion = 'low'; // Normal (Green)

                    console.log(`[Traffic Debug] Congestion for ${event.title}: ${event.congestion}`);
                } else {
                    event.congestion = 'low'; // Default to green if no static data
                    console.log(`[Traffic Debug] No staticDuration for ${event.title}, defaulting to 'low'`);
                }
            } else {
                console.log(`[Traffic Debug] No leg data for event ${index}: ${event.title}`);
            }
        });

        console.log('[Traffic Debug] Final events with congestion:', newOrder.map(e => ({ title: e.title, travelTime: e.travelTime, congestion: e.congestion })));
        return newOrder;
    } catch (e) {
        console.error('Error optimizing route:', e);
        return events;
    }
}
