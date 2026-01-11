import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Places API endpoint for parsing Google Maps URLs and fetching place details
// Requires GOOGLE_PLACES_API_KEY environment variable

interface PlaceDetails {
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

// Extract place ID from various Google Maps URL formats
function extractPlaceInfo(url: string): { placeId?: string; query?: string; coords?: { lat: number; lng: number } } {
    try {
        const urlObj = new URL(url);

        // Format: https://www.google.com/maps/place/.../@lat,lng,zoom/data=...!1s0x...
        // or: https://maps.app.goo.gl/... (short URL)
        // or: https://www.google.com/maps?q=...

        // Try to extract place ID from data parameter (format: !1sChIJ...)
        const dataMatch = url.match(/!1s(0x[a-f0-9]+:[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/);
        if (dataMatch) {
            return { placeId: dataMatch[1] };
        }

        // Try to extract from place_id query param
        const placeIdParam = urlObj.searchParams.get('place_id');
        if (placeIdParam) {
            return { placeId: placeIdParam };
        }

        // Try to extract coordinates from URL
        const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
            return {
                coords: {
                    lat: parseFloat(coordsMatch[1]),
                    lng: parseFloat(coordsMatch[2])
                }
            };
        }

        // Try to extract search query
        const qParam = urlObj.searchParams.get('q');
        if (qParam) {
            return { query: qParam };
        }

        // Extract name from URL path (last resort)
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            return { query: decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) };
        }

        return {};
    } catch {
        return {};
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Google Maps URL is required' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in Vercel environment variables'
        });
    }

    try {
        const placeInfo = extractPlaceInfo(url);
        let placeId = placeInfo.placeId;

        // If we don't have a place ID, try to find it via text search
        if (!placeId && (placeInfo.query || placeInfo.coords)) {
            const searchParams = new URLSearchParams({
                key: apiKey,
                ...(placeInfo.query && { query: placeInfo.query }),
                ...(placeInfo.coords && {
                    location: `${placeInfo.coords.lat},${placeInfo.coords.lng}`,
                    radius: '50'
                })
            });

            const searchUrl = placeInfo.query
                ? `https://maps.googleapis.com/maps/api/place/textsearch/json?${searchParams}`
                : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${searchParams}`;

            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.results && searchData.results.length > 0) {
                placeId = searchData.results[0].place_id;
            }
        }

        if (!placeId) {
            return res.status(404).json({
                error: 'Could not find place from URL',
                hint: 'Try copying the full URL from Google Maps'
            });
        }

        // Fetch place details
        const detailsParams = new URLSearchParams({
            place_id: placeId,
            key: apiKey,
            fields: 'name,formatted_address,rating,user_ratings_total,types,photos,opening_hours,website,formatted_phone_number,price_level,geometry,url'
        });

        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK' || !detailsData.result) {
            return res.status(404).json({
                error: 'Place not found',
                status: detailsData.status
            });
        }

        const place = detailsData.result;

        // Build photo URLs (limit to 3)
        const photoUrls = place.photos?.slice(0, 3).map((photo: { photo_reference: string }) =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`
        ) || [];

        const result: PlaceDetails = {
            name: place.name,
            address: place.formatted_address,
            rating: place.rating,
            reviewCount: place.user_ratings_total,
            placeId: placeId,
            types: place.types,
            photos: photoUrls,
            openingHours: place.opening_hours?.weekday_text,
            website: place.website,
            phoneNumber: place.formatted_phone_number,
            priceLevel: place.price_level,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            googleMapsUrl: place.url || url
        };

        return res.status(200).json(result);

    } catch (error) {
        console.error('Google Places API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch place details',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
