import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Places API (New) - Parse Place from URL and get details
// Uses Text Search API to find place from URL, then fetches details

// Extract place info from Google Maps URL
function extractFromUrl(url: string): { query?: string; placeId?: string; coords?: { lat: number; lng: number } } {
    const result: { query?: string; placeId?: string; coords?: { lat: number; lng: number } } = {};

    try {
        // Extract place name from /place/Name/ path
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            result.query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        }

        // Extract coordinates from @lat,lng pattern
        const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
            result.coords = {
                lat: parseFloat(coordsMatch[1]),
                lng: parseFloat(coordsMatch[2])
            };
        }

        // Extract place ID from data parameter
        const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/i);
        if (placeIdMatch) {
            // Convert hex format to proper format if needed
            result.placeId = placeIdMatch[1];
        }

        // Try q param
        const urlObj = new URL(url);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && !result.query) {
            result.query = qParam;
        }
    } catch (e) {
        console.log('Error parsing URL:', e);
    }

    return result;
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
        let expandedUrl = url;

        // Handle short URLs by following redirects
        if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'follow'
                });
                expandedUrl = response.url;
            } catch (e) {
                console.log('Could not expand short URL:', e);
            }
        }

        const extracted = extractFromUrl(expandedUrl);

        if (!extracted.query && !extracted.placeId) {
            return res.status(400).json({
                error: 'Could not extract place info from URL',
                hint: 'Please use a full Google Maps URL, not a shortened link'
            });
        }

        let placeId = extracted.placeId;

        // If we have a query but no placeId, use Text Search to find it
        if (!placeId && extracted.query) {
            const searchBody: Record<string, unknown> = {
                textQuery: extracted.query
            };

            // Add location bias if we have coordinates
            if (extracted.coords) {
                searchBody.locationBias = {
                    circle: {
                        center: {
                            latitude: extracted.coords.lat,
                            longitude: extracted.coords.lng
                        },
                        radius: 500
                    }
                };
            }

            const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri'
                },
                body: JSON.stringify(searchBody)
            });

            if (!searchResponse.ok) {
                const errorText = await searchResponse.text();
                console.error('Text search failed:', searchResponse.status, errorText);

                // Fallback: return extracted data
                return res.status(200).json({
                    name: extracted.query,
                    address: extracted.coords ? `${extracted.coords.lat}, ${extracted.coords.lng}` : 'Location',
                    googleMapsUrl: url,
                    source: 'url_parsing'
                });
            }

            const searchData = await searchResponse.json();

            if (searchData.places && searchData.places.length > 0) {
                const place = searchData.places[0];

                // Build photo URLs
                const photoUrls = place.photos?.slice(0, 5).map((photo: { name: string }) =>
                    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`
                ) || [];

                return res.status(200).json({
                    name: place.displayName?.text || extracted.query,
                    address: place.formattedAddress || '',
                    rating: place.rating,
                    reviewCount: place.userRatingCount,
                    placeId: place.id,
                    types: place.types,
                    photos: photoUrls,
                    openingHours: place.regularOpeningHours?.weekdayDescriptions,
                    isOpen: place.regularOpeningHours?.openNow,
                    googleMapsUrl: place.googleMapsUri || url,
                    source: 'google_places'
                });
            }
        }

        // If we have a placeId, fetch details directly
        if (placeId) {
            const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,types,photos,regularOpeningHours,googleMapsUri,reviews'
                }
            });

            if (detailsResponse.ok) {
                const place = await detailsResponse.json();

                const photoUrls = place.photos?.slice(0, 5).map((photo: { name: string }) =>
                    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`
                ) || [];

                return res.status(200).json({
                    name: place.displayName?.text || extracted.query || 'Unknown Place',
                    address: place.formattedAddress || '',
                    rating: place.rating,
                    reviewCount: place.userRatingCount,
                    placeId: place.id || placeId,
                    types: place.types,
                    photos: photoUrls,
                    openingHours: place.regularOpeningHours?.weekdayDescriptions,
                    isOpen: place.regularOpeningHours?.openNow,
                    googleMapsUrl: place.googleMapsUri || url,
                    reviews: place.reviews,
                    source: 'google_places'
                });
            }
        }

        // Fallback: return extracted data
        return res.status(200).json({
            name: extracted.query || 'Unknown Place',
            address: extracted.coords ? `${extracted.coords.lat}, ${extracted.coords.lng}` : 'See Google Maps',
            googleMapsUrl: url,
            source: 'url_parsing'
        });

    } catch (error) {
        console.error('Parse place error:', error);
        return res.status(500).json({
            error: 'Failed to parse place',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
