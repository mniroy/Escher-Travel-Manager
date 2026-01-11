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
        const response = await fetch('/api/parse-place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        // If we get a valid response, use it
        if (response.ok) {
            const data = await response.json();
            if (data && data.name) {
                return { success: true, data: data as PlaceDetails };
            }
        }
    } catch {
        // API not available (local dev), fall through to direct approach
    }

    // Fallback: Parse URL and extract basic info
    const placeInfo = extractPlaceInfo(url);

    if (!placeInfo.query && !placeInfo.coords && !placeInfo.placeId) {
        return {
            success: false,
            error: 'Could not extract place info from URL. Try copying the full Google Maps URL.',
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
